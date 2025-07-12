'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

const heroSlides = [
  {
    id: 1,
    title: 'Exquisite Indian Ethnic Wear',
    subtitle: 'Discover luxury without borders',
    description: 'Handcrafted designer lehengas, sarees, and sherwanis delivered to your doorstep. No need to travel to India.',
    image: '/images/hero/bridal-lehenga-hero.jpg',
    cta: 'Shop Collection',
    link: '/collections',
    overlay: 'bg-gradient-to-r from-black/60 to-transparent'
  },
  {
    id: 2,
    title: 'Wedding Planning Made Simple',
    subtitle: 'Your dream wedding, expertly curated',
    description: 'Complete wedding trousseau planning with our style quiz and expert consultations. From engagement to reception.',
    image: '/images/hero/wedding-planning-hero.jpg',
    cta: 'Start Planning',
    link: '/wedding-hub',
    overlay: 'bg-gradient-to-r from-maroon-900/70 to-transparent'
  },
  {
    id: 3,
    title: 'Artisan Craftsmanship',
    subtitle: 'Stories woven in silk and gold',
    description: 'Each piece tells a story of heritage, crafted by master artisans with techniques passed down through generations.',
    image: '/images/hero/artisan-craft-hero.jpg',
    cta: 'Discover Heritage',
    link: '/about/craftsmanship',
    overlay: 'bg-gradient-to-r from-teal-900/60 to-transparent'
  }
]

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-advance slides
  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    }, 6000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 10000)
  }

  return (
    <section className="relative h-screen min-h-[600px] overflow-hidden bg-gray-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            <Image
              src={heroSlides[currentSlide].image}
              alt={heroSlides[currentSlide].title}
              fill
              className="object-cover object-center"
              priority={currentSlide === 0}
              quality={90}
              sizes="100vw"
            />
            <div className={`absolute inset-0 ${heroSlides[currentSlide].overlay}`} />
          </div>

          {/* Content */}
          <div className="relative z-10 flex h-full items-center">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-2xl">
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="text-center sm:text-left"
                >
                  <p className="mb-4 text-sm font-medium tracking-wider text-gold-400 uppercase">
                    {heroSlides[currentSlide].subtitle}
                  </p>
                  
                  <h1 className="mb-6 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl font-playfair">
                    {heroSlides[currentSlide].title}
                  </h1>
                  
                  <p className="mb-8 text-lg text-gray-200 sm:text-xl">
                    {heroSlides[currentSlide].description}
                  </p>
                  
                  <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                    <Link
                      href={heroSlides[currentSlide].link}
                      className="inline-flex items-center justify-center rounded-md bg-maroon-600 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:ring-offset-2"
                    >
                      {heroSlides[currentSlide].cta}
                    </Link>
                    
                    <Link
                      href="/wedding-hub/style-quiz"
                      className="inline-flex items-center justify-center rounded-md border-2 border-white px-8 py-3 text-base font-medium text-white transition-colors hover:bg-white hover:text-maroon-900 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
                    >
                      Take Style Quiz
                    </Link>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Previous slide"
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </button>
      
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="Next slide"
      >
        <ChevronRightIcon className="h-6 w-6" />
      </button>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 space-x-2">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`h-2 w-8 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${
              currentSlide === index
                ? 'bg-white'
                : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 right-8 z-20 text-white">
        <div className="flex flex-col items-center space-y-2">
          <span className="text-xs uppercase tracking-wider">Scroll</span>
          <div className="h-8 w-px bg-white/60" />
        </div>
      </div>

      {/* Trust Badges */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/50 to-transparent">
        <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center space-x-6 text-white/80 sm:justify-start">
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Authentic Handcrafted</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Secure Shopping</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              <span className="text-sm">Worldwide Shipping</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}