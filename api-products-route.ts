import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Query parameter validation schema
const ProductQuerySchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '12')),
  category: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  occasion: z.string().optional(),
  fabric: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  sortBy: z.enum(['featured', 'price-asc', 'price-desc', 'name', 'newest']).optional().default('featured'),
  inStock: z.string().optional().transform(val => val === 'true')
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams.entries())
    
    // Validate and parse query parameters
    const {
      page,
      limit,
      category,
      search,
      minPrice,
      maxPrice,
      occasion,
      fabric,
      color,
      size,
      sortBy,
      inStock
    } = ProductQuerySchema.parse(queryParams)

    // Calculate pagination
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      isActive: true
    }

    // Category filter
    if (category) {
      where.category = {
        slug: category
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { searchKeywords: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Price range filter
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.AND = where.AND || []
      
      if (minPrice !== undefined) {
        where.AND.push({
          OR: [
            { salePrice: { gte: minPrice } },
            { 
              AND: [
                { salePrice: null },
                { basePrice: { gte: minPrice } }
              ]
            }
          ]
        })
      }
      
      if (maxPrice !== undefined) {
        where.AND.push({
          OR: [
            { salePrice: { lte: maxPrice } },
            { 
              AND: [
                { salePrice: null },
                { basePrice: { lte: maxPrice } }
              ]
            }
          ]
        })
      }
    }

    // Occasion filter
    if (occasion) {
      where.occasion = {
        has: occasion.toUpperCase()
      }
    }

    // Fabric filter
    if (fabric) {
      where.fabric = { contains: fabric, mode: 'insensitive' }
    }

    // Stock filter
    if (inStock) {
      where.stockQuantity = { gt: 0 }
    }

    // Color and size filters (through variants)
    if (color || size) {
      where.variants = {
        some: {
          AND: [
            color ? { color: { contains: color, mode: 'insensitive' } } : {},
            size ? { size: { contains: size, mode: 'insensitive' } } : {},
            { isActive: true }
          ]
        }
      }
    }

    // Build orderBy clause
    let orderBy: any = []
    
    switch (sortBy) {
      case 'price-asc':
        orderBy = [
          { salePrice: 'asc' },
          { basePrice: 'asc' }
        ]
        break
      case 'price-desc':
        orderBy = [
          { salePrice: 'desc' },
          { basePrice: 'desc' }
        ]
        break
      case 'name':
        orderBy = { name: 'asc' }
        break
      case 'newest':
        orderBy = { createdAt: 'desc' }
        break
      case 'featured':
      default:
        orderBy = [
          { isFeatured: 'desc' },
          { salesCount: 'desc' },
          { viewCount: 'desc' }
        ]
        break
    }

    // Get products with all related data
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1
          },
          variants: {
            where: { isActive: true },
            orderBy: { price: 'asc' },
            select: {
              id: true,
              name: true,
              price: true,
              stockQuantity: true,
              color: true,
              size: true,
              image: true
            }
          },
          reviews: {
            select: {
              rating: true
            }
          },
          _count: {
            select: {
              reviews: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ])

    // Transform products for response
    const transformedProducts = products.map(product => {
      const averageRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
        : 0

      const effectivePrice = product.salePrice || product.basePrice
      const hasDiscount = !!product.salePrice
      const discountPercentage = hasDiscount
        ? Math.round(((product.basePrice.toNumber() - product.salePrice!.toNumber()) / product.basePrice.toNumber()) * 100)
        : 0

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        basePrice: product.basePrice.toNumber(),
        salePrice: product.salePrice?.toNumber(),
        effectivePrice: effectivePrice.toNumber(),
        hasDiscount,
        discountPercentage,
        stockQuantity: product.stockQuantity,
        sku: product.sku,
        fabric: product.fabric,
        workType: product.workType,
        origin: product.origin,
        occasion: product.occasion,
        isFeatured: product.isFeatured,
        category: product.category,
        image: product.images[0]?.url || '/images/placeholder-product.jpg',
        variants: product.variants,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount: product._count.reviews,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    })

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      products: transformedProducts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        category,
        search,
        minPrice,
        maxPrice,
        occasion,
        fabric,
        color,
        size,
        sortBy,
        inStock
      }
    })

  } catch (error) {
    console.error('Error fetching products:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// Create a new product (Admin only)
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication middleware for admin users
    const body = await request.json()
    
    const ProductCreateSchema = z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      shortDescription: z.string().optional(),
      basePrice: z.number().positive(),
      salePrice: z.number().positive().optional(),
      sku: z.string().min(1),
      stockQuantity: z.number().int().min(0),
      categoryId: z.string(),
      fabric: z.string().optional(),
      workType: z.string().optional(),
      origin: z.string().optional(),
      artisan: z.string().optional(),
      occasion: z.array(z.string()).optional(),
      images: z.array(z.object({
        url: z.string().url(),
        altText: z.string().optional(),
        sortOrder: z.number().int().optional()
      })).optional(),
      attributes: z.array(z.object({
        name: z.string(),
        value: z.string()
      })).optional(),
      variants: z.array(z.object({
        name: z.string(),
        sku: z.string(),
        price: z.number().positive(),
        stockQuantity: z.number().int().min(0),
        color: z.string().optional(),
        size: z.string().optional(),
        image: z.string().optional()
      })).optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      searchKeywords: z.string().optional(),
      isFeatured: z.boolean().optional()
    })

    const productData = ProductCreateSchema.parse(body)

    const product = await prisma.product.create({
      data: {
        ...productData,
        images: productData.images ? {
          create: productData.images
        } : undefined,
        attributes: productData.attributes ? {
          create: productData.attributes
        } : undefined,
        variants: productData.variants ? {
          create: productData.variants
        } : undefined
      },
      include: {
        category: true,
        images: true,
        attributes: true,
        variants: true
      }
    })

    return NextResponse.json(product, { status: 201 })

  } catch (error) {
    console.error('Error creating product:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid product data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}