// Mobile Test Script - Logs mobile detection and layout status

(function() {
  'use strict';

  console.log('=== MOBILE TEST SCRIPT ===');
  
  // Mobile detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth < 768;
  const shouldApplyMobileStyles = isMobile || isSmallScreen;
  
  console.log('User Agent:', navigator.userAgent);
  console.log('Window Width:', window.innerWidth);
  console.log('Window Height:', window.innerHeight);
  console.log('Is Mobile Device:', isMobile);
  console.log('Is Small Screen:', isSmallScreen);
  console.log('Should Apply Mobile Styles:', shouldApplyMobileStyles);
  
  // Check if mobile classes are applied
  console.log('HTML has mobile-detected class:', document.documentElement.classList.contains('mobile-detected'));
  console.log('Body has mobile-body class:', document.body.classList.contains('mobile-body'));
  
  // Check dashboard elements
  setTimeout(() => {
    const dashV4 = document.querySelector('.dash-v4');
    const statsGrid = document.querySelector('.dash-v4-stats');
    const hamburger = document.querySelector('.topbar-hamburger');
    const topbarNav = document.querySelector('.topbar-nav');
    
    console.log('=== DASHBOARD ELEMENTS ===');
    console.log('Dashboard container found:', !!dashV4);
    if (dashV4) {
      console.log('Dashboard padding:', window.getComputedStyle(dashV4).padding);
      console.log('Dashboard gap:', window.getComputedStyle(dashV4).gap);
    }
    
    console.log('Stats grid found:', !!statsGrid);
    if (statsGrid) {
      console.log('Stats grid columns:', window.getComputedStyle(statsGrid).gridTemplateColumns);
      console.log('Stats grid gap:', window.getComputedStyle(statsGrid).gap);
    }
    
    console.log('=== NAVIGATION ELEMENTS ===');
    console.log('Hamburger found:', !!hamburger);
    if (hamburger) {
      console.log('Hamburger display:', window.getComputedStyle(hamburger).display);
    }
    
    console.log('Topbar nav found:', !!topbarNav);
    if (topbarNav) {
      console.log('Topbar nav display:', window.getComputedStyle(topbarNav).display);
    }
    
    // Check for hidden elements
    const mobileHideElements = document.querySelectorAll('.mobile-hide');
    console.log('Mobile hide elements found:', mobileHideElements.length);
    mobileHideElements.forEach((el, index) => {
      console.log(`Mobile hide element ${index} display:`, window.getComputedStyle(el).display);
    });
    
    // Check for complex sections that should be hidden
    const rankSection = document.getElementById('rankSection');
    const twoCols = document.querySelectorAll('.dash-v4-twocol');
    
    console.log('Rank section found:', !!rankSection);
    if (rankSection) {
      console.log('Rank section display:', window.getComputedStyle(rankSection).display);
    }
    
    console.log('Two column sections found:', twoCols.length);
    twoCols.forEach((col, index) => {
      console.log(`Two column section ${index} display:`, window.getComputedStyle(col).display);
    });
    
  }, 1000);
  
})();