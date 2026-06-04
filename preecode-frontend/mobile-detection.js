// Mobile Detection and Immediate Enhancements
// This script runs immediately to detect mobile and apply critical mobile styles

(function() {
  'use strict';

  // Immediate mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth < 768;
  const shouldApplyMobileStyles = isMobile || isSmallScreen;

  // Add mobile classes immediately
  if (shouldApplyMobileStyles) {
    document.documentElement.classList.add('mobile-detected');
    document.body.classList.add('mobile-body');
    
    // Set viewport height immediately
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }

  // Add critical mobile CSS immediately
  if (shouldApplyMobileStyles) {
    const criticalMobileCSS = document.createElement('style');
    criticalMobileCSS.id = 'critical-mobile-css';
    criticalMobileCSS.textContent = `
      .mobile-detected {
        font-size: 14px;
      }
      
      .mobile-body {
        overflow-x: hidden !important;
        -webkit-text-size-adjust: 100%;
        -webkit-tap-highlight-color: rgba(255, 161, 22, 0.2);
      }
      
      @media (max-width: 767px) {
        .topbar-nav {
          display: none !important;
        }
        
        .topbar-hamburger {
          display: flex !important;
        }
        
        .dash-v4-stats {
          grid-template-columns: 1fr !important;
        }
        
        .dash-v4-twocol {
          grid-template-columns: 1fr !important;
        }
        
        .prof-header-inner {
          flex-direction: column !important;
          text-align: center !important;
        }
        
        .prob-filter-bar {
          flex-direction: column !important;
        }
        
        .page-content {
          padding: 16px !important;
        }
        
        .dash-v4 {
          padding: 16px !important;
        }
      }
      
      @media (max-width: 480px) {
        .page-content {
          padding: 12px !important;
        }
        
        .dash-v4 {
          padding: 12px !important;
        }
      }
    `;
    document.head.appendChild(criticalMobileCSS);
  }

  // Handle orientation changes
  window.addEventListener('orientationchange', function() {
    setTimeout(() => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }, 100);
  });

  // Handle resize
  window.addEventListener('resize', function() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

})();