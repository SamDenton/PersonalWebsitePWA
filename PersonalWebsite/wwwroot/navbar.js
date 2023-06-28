function initNavbar() {
    var navbar = document.querySelector('.sidebarController');
    var icon = document.querySelector('.icon');
    var mq = window.matchMedia('(max-width: 689.98px)');

    // Set initial state based on screen size
    if (mq.matches) {
        navbar.classList.add('navHider');
        icon.classList.remove('rotateLeft');
        icon.classList.add('rotateRight');
    } else {
        navbar.classList.add('navShower');
        icon.classList.remove('rotateRight');
        icon.classList.add('rotateLeft');
    }

    // Listen for clicks on the icon
    icon.addEventListener('click', function () {
        if (navbar.classList.contains('navShower')) {
            navbar.classList.remove('navShower');
            navbar.classList.add('navHider');
            icon.classList.remove('rotateLeft');
            icon.classList.add('rotateRight');
        } else {
            navbar.classList.remove('navHider');
            navbar.classList.add('navShower');
            icon.classList.remove('rotateRight');
            icon.classList.add('rotateLeft');
        }
    });

    // Listen for screen size changes
    mq.addListener(function () {
        if (mq.matches) {
            navbar.classList.remove('navShower');
            navbar.classList.add('navHider');
            icon.classList.remove('rotateLeft');
            icon.classList.add('rotateRight');
        } else {
            navbar.classList.remove('navHider');
            navbar.classList.add('navShower');
            icon.classList.remove('rotateRight');
            icon.classList.add('rotateLeft');
        }
    });
}

function initNavbarMobile() {
    var navbar = document.querySelector('.sidebarController');
    var links = document.querySelectorAll('.lastLink');
    var icon = document.querySelector('.icon');
    links.forEach(function (link) {
        // Listen for clicks on the link
        link.addEventListener('click', function () {
            if (navbar.classList.contains('navShower') && window.innerWidth < 690) {
                navbar.classList.remove('navShower');
                navbar.classList.add('navHider');
                icon.classList.remove('rotateLeft');
                icon.classList.add('rotateRight');
            } else {
                navbar.classList.remove('navHider');
                navbar.classList.add('navShower');
                icon.classList.remove('rotateRight');
                icon.classList.add('rotateLeft');
            }
        });
    });
}

function fadeOut() {
    var elements = document.querySelectorAll('.fade-in');
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add('fade-out');
    }
}

let navContainer, scrollContainer, nav, popupTip;
let isMouseOverNav, isTouchActive, animationStarted = false;
let currentTop = 0, prevTop = 0, startY = 0, startX = 0;
let maxTop, containerHeight, navHeight, navItemsHeight, initialY, tooltipTimeout;
const momentumFactor = 0.95;
const fadeEffectStrength = 0.05;
let menuCount = 1;

function initScrollingMenu(navContainerSelector, scrollContainerSelector, navSelector) {
    navContainer = document.querySelector(navContainerSelector);
    scrollContainer = document.querySelector(scrollContainerSelector);
    nav = document.querySelector(navSelector);

    popupTip = document.querySelector('#popupTip');

    navContainer.addEventListener("mouseenter", onMouseEnter);
    navContainer.addEventListener("mousemove", onMouseMove);
    navContainer.addEventListener("mouseleave", onMouseLeave);
    navContainer.addEventListener("touchstart", onTouchStart, { passive: true });
    navContainer.addEventListener("touchend", onTouchEnd, { passive: true });
    setTimeout(() => {
        const navItemsContainer = nav.querySelector('.nav-items-container');
        const navItemsContainerClone1 = navItemsContainer.cloneNode(true);
        const navItemsContainerClone2 = navItemsContainer.cloneNode(true);

        if (menuCount == 3) {
            nav.prepend(navItemsContainerClone1);
            nav.append(navItemsContainerClone2);
        }
        containerHeight = navContainer.offsetHeight;
        navHeight = nav.offsetHeight;
        navItemsHeight = navItemsContainer.offsetHeight;
        maxTop = containerHeight - ((navHeight * 3) / 2);

        currentTop = ((containerHeight - navItemsHeight * menuCount) / 2) + 50; // Update currentTop calculation
        scrollContainer.style.top = `${currentTop}px`;
    }, 500); // Set the delay time in milliseconds (e.g., 500ms)
}

function calculateScrollSpeed(mouseY, startY, maxSpeed) {
    const distanceToStart = Math.abs(mouseY - startY);
    const speed = (distanceToStart / (containerHeight / 1)) / 1;

    if (speed > maxSpeed) {
        return maxSpeed;
    }

    return speed;
}

function onMouseEnter(event) {
    const navContainerRect = navContainer.getBoundingClientRect();
    //startY = event.clientY - navContainerRect.top;
    startY = containerHeight / 2;
    startX = event.clientX - navContainerRect.left;
    // Show the tooltip
    popupTip.style.display = 'block';
    popupTip.style.top = `${startY - 45}px`;
    popupTip.style.left = `${startX - 10}px`;
    // Hide the tooltip after 3 seconds
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
        popupTip.style.display = 'none';
    }, 4000);
}

function onMouseMove(event) {
    if (isTouchActive) { return };
    const navContainerRect = navContainer.getBoundingClientRect();
    let moveY = event.clientY - navContainerRect.top;
    let moveX = event.clientX - navContainerRect.left;

    // Update the tooltip position
    popupTip.style.top = `${moveY - 45}px`;
    popupTip.style.left = `${moveX - 10}px`;
    isMouseOverNav = true;
    navHeight = nav.offsetHeight;
    containerHeight = navContainer.offsetHeight;
    if (navHeight > containerHeight) {
        const mouseY = event.clientY - navContainerRect.top;
        const scrollPosition = (mouseY - startY) / (containerHeight / 2);

        // Calculate scrolling speed based on the mouse position
        const maxSpeed = 0.2; // Set the maximum scrolling speed
        const speed = calculateScrollSpeed(mouseY, startY, maxSpeed);
        const newTop = maxTop * scrollPosition * speed - (navHeight - containerHeight) / 2;

        updatePosition(newTop);

    }

    // Start the animation loop only if it has not been started
    if (!animationStarted) {
        animationStarted = true;
        animateMouseMove(event);
    }
}

function animateMouseMove(event) {
    if (isTouchActive) { return };
    if (isMouseOverNav) {
        window.requestAnimationFrame(() => onMouseMove(event));
    } else {
        // Reset the animationStarted flag when the mouse leaves the nav
        animationStarted = false;
    }
}

const bounceFactor = 0.5; // Change this value to control the strength of the bounce
let hasBouncedTop = false;
let hasBouncedBottom = false;

function updatePosition(targetTop) {
    const smoothingFactor = 0.05; // Change this value to control the smoothness of the animation
    prevTop = currentTop; // Store the current top position before updating

    // Calculate the new position
    let newTop = currentTop + (targetTop - currentTop) * smoothingFactor;

    // Adjust the target position if the new position is beyond the top boundary
    if (newTop > 10 && !hasBouncedTop) {
        targetTop = currentTop - Math.abs(newTop) * (bounceFactor + 0.2);
        hasBouncedTop = true;
    }

    // Adjust the target position if the new position is beyond the bottom boundary
    if (newTop < window.innerHeight - navHeight - 56 && !hasBouncedBottom) {
        targetTop = currentTop - (newTop - (window.innerHeight - navHeight)) * bounceFactor;
        hasBouncedBottom = true;
    }

    // Recalculate the new position with the adjusted target position
    newTop = currentTop + (targetTop - currentTop) * smoothingFactor;

    currentTop = newTop;
    scrollContainer.style.top = `${currentTop}px`;
}

    //applyEffects();

function applyMomentum(targetTop, momentum) {
    if (isTouchActive) { return };
    if (Math.abs(momentum) < 0.001) {
        return targetTop;
    }

    const newTargetTop = targetTop + momentum;
    const newMomentum = momentum * momentumFactor;

    return applyMomentum(newTargetTop, newMomentum);
}

function onMouseLeave(event) {
    isMouseOverNav = false; // Set the flag to false when the mouse leaves the navbar
    animationStarted = false;
    if (!animationStarted) {
        // Calculate the momentum based on the difference between the current and previous top positions
        const momentum = (currentTop - prevTop) * momentumFactor;
        //alert(currentTop + " " + prevTop + " " + momentum);
        // Apply the momentum to the target top position
        const targetTopWithMomentum = applyMomentum(currentTop, momentum);
        //alert(momentum)
        // Update the position with the new target top
        updatePosition(targetTopWithMomentum);

        // Start the animation loop to apply the momentum smoothly
        animationStarted = true;
    }

    if (Math.abs(currentTop - prevTop) > 0.05) {
        window.requestAnimationFrame(() => onMouseLeave(event));
    } else {
        // Reset the animationStarted flag when the momentum effect has ended
        animationStarted = false;
    }
    hasBouncedTop = false;
    hasBouncedBottom = false;
    popupTip.style.display = 'none';  // Hide the tooltip when the mouse leaves the navbar
}

function onTouchStart(event) {
    isTouchActive = true;
    navContainer.classList.remove("nav-container");
    navContainer.classList.add("nav-container-touch");
}

function onTouchEnd(event) {
    isTouchActive = false;
    navContainer.classList.remove("nav-container-touch");
    navContainer.classList.add("nav-container");
}

window.initScrollingMenu = initScrollingMenu;