import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { items, shippingAddress, billingAddress, customerNotes } = await request.json()

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items in cart' },
        { status: 400 }
      )
    }

    // Validate and get product details from database
    const productIds = items.map((item: any) => item.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1
        },
        variants: true
      }
    })

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Some products are no longer available' },
        { status: 400 }
      )
    }

    // Calculate totals and validate inventory
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let subtotal = 0

    for (const cartItem of items) {
      const product = products.find(p => p.id === cartItem.productId)
      if (!product) {
        return NextResponse.json(
          { error: `Product ${cartItem.productId} not found` },
          { status: 400 }
        )
      }

      // Check variant if specified
      let variant = null
      if (cartItem.variantId) {
        variant = product.variants.find(v => v.id === cartItem.variantId)
        if (!variant) {
          return NextResponse.json(
            { error: `Product variant ${cartItem.variantId} not found` },
            { status: 400 }
          )
        }
      }

      // Determine price and stock
      const price = variant ? variant.price : (product.salePrice || product.basePrice)
      const stock = variant ? variant.stockQuantity : product.stockQuantity

      // Check inventory
      if (cartItem.quantity > stock) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}` },
          { status: 400 }
        )
      }

      const unitAmountCents = Math.round(price.toNumber() * 100)
      subtotal += price.toNumber() * cartItem.quantity

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: product.shortDescription || undefined,
            images: product.images.length > 0 ? [product.images[0].url] : undefined,
            metadata: {
              productId: product.id,
              variantId: variant?.id || '',
              sku: variant?.sku || product.sku,
              size: cartItem.size || '',
              color: cartItem.color || '',
              customizations: JSON.stringify(cartItem.customizations || {})
            }
          },
          unit_amount: unitAmountCents
        },
        quantity: cartItem.quantity
      })
    }

    // Calculate shipping
    const shippingCost = calculateShipping(subtotal)
    
    // Add shipping as line item if applicable
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping',
            description: 'Standard shipping'
          },
          unit_amount: Math.round(shippingCost * 100)
        },
        quantity: 1
      })
    }

    // Generate unique order number
    const orderNumber = `GD${Date.now()}`

    // Create pending order in database
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: session?.user?.id,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotal,
        taxAmount: 0, // Will be calculated by Stripe
        shippingAmount: shippingCost,
        discountAmount: 0,
        totalAmount: subtotal + shippingCost,
        shippingAddress,
        billingAddress,
        customerNotes,
        items: {
          create: items.map((cartItem: any) => {
            const product = products.find(p => p.id === cartItem.productId)!
            const variant = cartItem.variantId 
              ? product.variants.find(v => v.id === cartItem.variantId)
              : null
            
            const price = variant ? variant.price : (product.salePrice || product.basePrice)
            
            return {
              productId: cartItem.productId,
              quantity: cartItem.quantity,
              unitPrice: price,
              totalPrice: price.toNumber() * cartItem.quantity,
              productName: product.name,
              productImage: product.images[0]?.url,
              productSku: variant?.sku || product.sku,
              customizations: cartItem.customizations
            }
          })
        }
      }
    })

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXTAUTH_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${order.id}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/cart`,
      customer_email: session?.user?.email || undefined,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU']
      },
      billing_address_collection: 'required',
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber
        }
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
    })

    // Update order with Stripe session ID
    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentId: checkoutSession.id }
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      orderId: order.id
    })

  } catch (error) {
    console.error('Checkout error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

// Helper function to calculate shipping
function calculateShipping(subtotal: number): number {
  // Free shipping over $150
  if (subtotal >= 150) return 0
  
  // Tiered shipping rates
  if (subtotal >= 100) return 9.99
  if (subtotal >= 50) return 14.99
  
  return 19.99
}