'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import toast from 'react-hot-toast'

export interface CartItem {
  id: string
  productId: string
  variantId?: string
  name: string
  image: string
  price: number
  quantity: number
  size?: string
  color?: string
  customizations?: Record<string, any>
  maxQuantity: number
  sku: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  
  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (itemId: string) => void
  updateQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  openCart: () => void
  closeCart: () => void
  
  // Computed values
  getTotalItems: () => number
  getTotalPrice: () => number
  getItemCount: (productId: string, variantId?: string) => number
  hasItem: (productId: string, variantId?: string) => boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (newItem) => {
        const state = get()
        const existingItemIndex = state.items.findIndex(
          item => 
            item.productId === newItem.productId && 
            item.variantId === newItem.variantId &&
            JSON.stringify(item.customizations) === JSON.stringify(newItem.customizations)
        )

        if (existingItemIndex > -1) {
          // Update existing item quantity
          const existingItem = state.items[existingItemIndex]
          const newQuantity = existingItem.quantity + newItem.quantity
          
          if (newQuantity > existingItem.maxQuantity) {
            toast.error(`Only ${existingItem.maxQuantity} items available in stock`)
            return
          }

          set(state => ({
            items: state.items.map((item, index) =>
              index === existingItemIndex
                ? { ...item, quantity: newQuantity }
                : item
            )
          }))
          
          toast.success(`Updated quantity in cart`)
        } else {
          // Add new item
          if (newItem.quantity > newItem.maxQuantity) {
            toast.error(`Only ${newItem.maxQuantity} items available in stock`)
            return
          }

          const cartItem: CartItem = {
            ...newItem,
            id: crypto.randomUUID()
          }

          set(state => ({
            items: [...state.items, cartItem]
          }))
          
          toast.success(`${newItem.name} added to cart`)
        }

        // Auto-open cart drawer for 3 seconds
        get().openCart()
        setTimeout(() => {
          get().closeCart()
        }, 3000)
      },

      removeItem: (itemId) => {
        const state = get()
        const item = state.items.find(item => item.id === itemId)
        
        set(state => ({
          items: state.items.filter(item => item.id !== itemId)
        }))
        
        if (item) {
          toast.success(`${item.name} removed from cart`)
        }
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId)
          return
        }

        const state = get()
        const item = state.items.find(item => item.id === itemId)
        
        if (!item) return

        if (quantity > item.maxQuantity) {
          toast.error(`Only ${item.maxQuantity} items available in stock`)
          return
        }

        set(state => ({
          items: state.items.map(item =>
            item.id === itemId
              ? { ...item, quantity }
              : item
          )
        }))
      },

      clearCart: () => {
        set({ items: [] })
        toast.success('Cart cleared')
      },

      toggleCart: () => {
        set(state => ({ isOpen: !state.isOpen }))
      },

      openCart: () => {
        set({ isOpen: true })
      },

      closeCart: () => {
        set({ isOpen: false })
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getTotalPrice: () => {
        return get().items.reduce((total, item) => total + (item.price * item.quantity), 0)
      },

      getItemCount: (productId, variantId) => {
        const items = get().items.filter(
          item => item.productId === productId && item.variantId === variantId
        )
        return items.reduce((total, item) => total + item.quantity, 0)
      },

      hasItem: (productId, variantId) => {
        return get().items.some(
          item => item.productId === productId && item.variantId === variantId
        )
      }
    }),
    {
      name: 'glamorousdesi-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        items: state.items 
      })
    }
  )
)

// Selectors for better performance
export const useCartItems = () => useCartStore(state => state.items)
export const useCartIsOpen = () => useCartStore(state => state.isOpen)
export const useCartActions = () => useCartStore(state => ({
  addItem: state.addItem,
  removeItem: state.removeItem,
  updateQuantity: state.updateQuantity,
  clearCart: state.clearCart,
  toggleCart: state.toggleCart,
  openCart: state.openCart,
  closeCart: state.closeCart
}))
export const useCartTotals = () => useCartStore(state => ({
  totalItems: state.getTotalItems(),
  totalPrice: state.getTotalPrice()
}))

// Helper functions for cart calculations
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price)
}

export const calculateShipping = (totalPrice: number): number => {
  // Free shipping over $150
  if (totalPrice >= 150) return 0
  
  // Standard shipping rates
  if (totalPrice >= 100) return 9.99
  if (totalPrice >= 50) return 14.99
  
  return 19.99
}

export const calculateTax = (subtotal: number, state: string = 'CA'): number => {
  // Simplified tax calculation - would need proper tax service integration
  const taxRates: Record<string, number> = {
    'CA': 0.0875, // California
    'NY': 0.08,   // New York
    'TX': 0.0625, // Texas
    'FL': 0.06,   // Florida
    'WA': 0.065,  // Washington
    // Add more states as needed
  }
  
  const rate = taxRates[state] || 0.07 // Default 7%
  return subtotal * rate
}

// Cart item validation
export const validateCartItem = (item: Partial<CartItem>): string[] => {
  const errors: string[] = []
  
  if (!item.productId) errors.push('Product ID is required')
  if (!item.name) errors.push('Product name is required')
  if (!item.price || item.price <= 0) errors.push('Valid price is required')
  if (!item.quantity || item.quantity <= 0) errors.push('Valid quantity is required')
  if (item.maxQuantity && item.quantity && item.quantity > item.maxQuantity) {
    errors.push(`Quantity cannot exceed ${item.maxQuantity}`)
  }
  
  return errors
}

// Cart analytics helper
export const trackCartEvent = (event: string, data?: any) => {
  // Integration with analytics services like Google Analytics 4
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event, {
      event_category: 'ecommerce',
      ...data
    })
  }
}

// Cart persistence helper for cross-device synchronization
export const syncCartWithServer = async (userId: string, items: CartItem[]) => {
  try {
    const response = await fetch('/api/cart/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, items })
    })
    
    if (!response.ok) {
      throw new Error('Failed to sync cart')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Cart sync error:', error)
    return null
  }
}