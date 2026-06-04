// Mobile Enhancement Script for Preecode
// Handles mobile-specific interactions and optimizations

(function() {
  'use strict';

  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Add mobile class to body
  if (isMobile || isTouch) {
    document.body.classList.add('is-mobile');
  }

  // Prevent zoom on input focus for iOS
  function preventZoom() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.type !== 'file') {
        input.addEventListener('focus', function() {
          if (window.innerWidth < 768) {
            const fontSize = window.getComputedStyle(this).fontSize;
            if (parseFloat(fontSize) < 16) {
              this.style.fontSize = '16px';
            }
          }
        });
        
        input.addEventListener('blur', function() {
          this.style.fontSize = '';
        });
      }
    });
  }

  // Enhanced touch interactions
  function enhanceTouchInteractions() {
    // Add touch feedback to buttons
    const buttons = document.querySelectorAll('button, .btn, [role="button"]');
    buttons.forEach(button => {
      button.addEventListener('touchstart', function() {
        this.classList.add('touch-active');
      });
      
      button.addEventListener('touchend', function() {
        setTimeout(() => {
          this.classList.remove('touch-active');
        }, 150);
      });
    });

    // Improve scroll performance on mobile
    const scrollElements = document.querySelectorAll('.overflow-auto, .overflow-y-auto, .overflow-x-auto');
    scrollElements.forEach(element => {
      element.style.webkitOverflowScrolling = 'touch';
    });
  }

  // Mobile navigation enhancements
  function enhanceMobileNavigation() {
    const hamburger = document.querySelector('.topbar-hamburger');
    const mobileMenu = document.querySelector('.topbar-mobile-menu');
    
    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', function() {
        const isOpen = !mobileMenu.classList.contains('hidden');
        
        if (isOpen) {
          mobileMenu.classList.remove('open');
          setTimeout(() => {
            mobileMenu.classList.add('hidden');
          }, 200);
        } else {
          mobileMenu.classList.remove('hidden');
          setTimeout(() => {
            mobileMenu.classList.add('open');
          }, 10);
        }
        
        // Update hamburger icon
        this.classList.toggle('active');
      });

      // Close menu when clicking outside
      document.addEventListener('click', function(e) {
        if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
          if (!mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.remove('open');
            hamburger.classList.remove('active');
            setTimeout(() => {
              mobileMenu.classList.add('hidden');
            }, 200);
          }
        }
      });
    }
  }

  // Optimize images for mobile
  function optimizeImagesForMobile() {
    if (window.innerWidth < 768) {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        // Add loading="lazy" for better performance
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }
        
        // Optimize image sizes for mobile
        if (img.src && !img.src.includes('?')) {
          const url = new URL(img.src, window.location.origin);
          url.searchParams.set('w', Math.min(window.innerWidth * 2, 800));
          url.searchParams.set('q', '85');
          // Only apply if it's an external image service
          if (url.hostname.includes('cloudinary') || url.hostname.includes('imagekit')) {
            img.src = url.toString();
          }
        }
      });
    }
  }

  // Handle orientation changes
  function handleOrientationChange() {
    window.addEventListener('orientationchange', function() {
      // Delay to ensure viewport has updated
      setTimeout(() => {
        // Recalculate viewport height for mobile browsers
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Trigger resize event for components that need it
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });
  }

  // Mobile-specific modal handling
  function enhanceMobileModals() {
    const modals = document.querySelectorAll('.modal-overlay, .ea-overlay');
    modals.forEach(modal => {
      modal.addEventListener('touchmove', function(e) {
        // Prevent background scrolling when modal is open
        if (e.target === this) {
          e.preventDefault();
        }
      }, { passive: false });
    });
  }

  // Improve form interactions on mobile
  function enhanceMobileFormInteractions() {
    // Auto-scroll to focused input on mobile
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('focus', function() {
        if (window.innerWidth < 768) {
          setTimeout(() => {
            this.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }, 300); // Delay to account for keyboard animation
        }
      });
    });

    // Enhanced password toggle for mobile
    const passwordToggles = document.querySelectorAll('.pw-toggle');
    passwordToggles.forEach(toggle => {
      toggle.addEventListener('touchstart', function(e) {
        e.preventDefault(); // Prevent double-tap zoom
      });
    });
  }

  // Mobile-specific AI chat enhancements
  function enhanceMobileAIChat() {
    const aiPanel = document.querySelector('.ai-chat-panel');
    const aiFab = document.querySelector('.ai-chat-fab');
    
    if (aiPanel && aiFab) {
      // Handle mobile keyboard appearance
      let initialViewportHeight = window.innerHeight;
      
      window.addEventListener('resize', function() {
        if (window.innerWidth < 768) {
          const currentHeight = window.innerHeight;
          const heightDifference = initialViewportHeight - currentHeight;
          
          // If keyboard is likely open (significant height reduction)
          if (heightDifference > 150) {
            aiPanel.style.maxHeight = `${currentHeight * 0.6}px`;
          } else {
            aiPanel.style.maxHeight = '';
          }
        }
      });

      // Improve touch scrolling in chat messages
      const messagesContainer = aiPanel.querySelector('.ai-chat-messages');
      if (messagesContainer) {
        messagesContainer.style.webkitOverflowScrolling = 'touch';
        
        // Auto-scroll to bottom when new messages arrive
        const observer = new MutationObserver(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
        
        observer.observe(messagesContainer, {
          childList: true,
          subtree: true
        });
      }
    }
  }

  // Performance optimizations for mobile
  function optimizePerformance() {
    // Reduce animations on low-end devices
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      document.body.classList.add('reduce-motion');
    }

    // Optimize scroll performance
    let ticking = false;
    function updateScrollPosition() {
      // Update scroll-dependent elements
      const scrollY = window.pageYOffset;
      document.documentElement.style.setProperty('--scroll-y', scrollY + 'px');
      ticking = false;
    }

    window.addEventListener('scroll', function() {
      if (!ticking) {
        requestAnimationFrame(updateScrollPosition);
        ticking = true;
      }
    }, { passive: true });
  }

  // Initialize mobile enhancements
  function init() {
    // Set initial viewport height
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    // Apply enhancements
    preventZoom();
    enhanceTouchInteractions();
    enhanceMobileNavigation();
    optimizeImagesForMobile();
    handleOrientationChange();
    enhanceMobileModals();
    enhanceMobileFormInteractions();
    enhanceMobileAIChat();
    optimizePerformance();

    // Add mobile-specific CSS classes
    if (window.innerWidth < 768) {
      document.body.classList.add('mobile-viewport');
    }

    // Handle viewport changes
    window.addEventListener('resize', function() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      
      if (window.innerWidth < 768) {
        document.body.classList.add('mobile-viewport');
      } else {
        document.body.classList.remove('mobile-viewport');
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Add CSS for mobile enhancements
  const mobileCSS = `
    .touch-active {
      transform: scale(0.98);
      opacity: 0.8;
    }
    
    .is-mobile .hover\\:scale-105:hover {
      transform: none;
    }
    
    .reduce-motion * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    
    .mobile-viewport {
      height: 100vh;
      height: calc(var(--vh, 1vh) * 100);
    }
    
    @media (max-width: 767px) {
      .topbar-hamburger.active .hamburger-icon {
        transform: rotate(90deg);
      }
      
      .ai-chat-panel {
        height: auto;
        max-height: 85vh;
        max-height: calc(var(--vh, 1vh) * 85);
      }
      
      .modal-overlay,
      .ea-overlay {
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);
      }
    }
  `;

  // Inject mobile CSS
  const style = document.createElement('style');
  style.textContent = mobileCSS;
  document.head.appendChild(style);

})();