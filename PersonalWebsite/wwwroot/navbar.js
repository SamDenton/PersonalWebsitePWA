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

function fadeOut() {
    var elements = document.querySelectorAll('.fade-in');
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add('fade-out');
    }
}

let navContainer, scrollContainer, nav;
let isMouseOverNav = false;
let currentTop = 0, prevTop = 0;
let maxTop, containerHeight, navHeight, navItemsHeight;
let animationStarted = false;
const momentumFactor = 0.951;
const fadeEffectStrength = 0.3;

function initScrollingMenu(navContainerSelector, scrollContainerSelector, navSelector) {
    navContainer = document.querySelector(navContainerSelector);
    scrollContainer = document.querySelector(scrollContainerSelector);
    nav = document.querySelector(navSelector);
    navContainer.addEventListener("mousemove", onMouseMove);
    navContainer.addEventListener("mouseleave", onMouseLeave);
    navContainer.addEventListener("touchstart", onTouchStart, { passive: true });
    navContainer.addEventListener("touchmove", onTouchMove, { passive: false });
    navContainer.addEventListener("touchend", onTouchEnd, { passive: true });
    setTimeout(() => {
        const navItemsContainer = nav.querySelector('.nav-items-container');
        const navItemsContainerClone1 = navItemsContainer.cloneNode(true);
        const navItemsContainerClone2 = navItemsContainer.cloneNode(true);

        nav.prepend(navItemsContainerClone1);
        nav.append(navItemsContainerClone2);
        containerHeight = navContainer.offsetHeight;
        navHeight = nav.offsetHeight;
        navItemsHeight = navItemsContainer.offsetHeight;
        maxTop = containerHeight - ((navHeight * 3) / 2);

        currentTop = (containerHeight - navItemsHeight * 3) / 2; // Update currentTop calculation
        scrollContainer.style.top = `${currentTop}px`;
        applyEffects();
    }, 500); // Set the delay time in milliseconds (e.g., 500ms)
}

function calculateScrollSpeed(mouseY, containerHeight, maxSpeed) {
    const distanceToMiddle = Math.abs(mouseY - containerHeight / 2);
    const speed = (distanceToMiddle / (containerHeight / 2)) / 2;

    if (speed > maxSpeed) {
        return maxSpeed;
    }

    return speed;
}

function onMouseMove(event) {
    if (isTouchActive) { return };
    isMouseOverNav = true;
    navHeight = nav.offsetHeight;
    containerHeight = navContainer.offsetHeight;
    if (navHeight > containerHeight) {
        const navContainerRect = navContainer.getBoundingClientRect();
        const mouseY = event.clientY - navContainerRect.top;
        const scrollPosition = (mouseY - containerHeight / 2) / (containerHeight / 2);
        maxTop = containerHeight - ((navHeight * 3) / 2);

        // Calculate scrolling speed based on the mouse position
        const maxSpeed = 0.1; // Set the maximum scrolling speed
        const speed = calculateScrollSpeed(mouseY, containerHeight, maxSpeed);
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
    if (isMouseOverNav) {
        window.requestAnimationFrame(() => onMouseMove(event));
    } else {
        // Reset the animationStarted flag when the mouse leaves the nav
        animationStarted = false;
    }
}

function updatePosition(targetTop) {
    const smoothingFactor = 0.05; // Change this value to control the smoothness of the animation
    prevTop = currentTop; // Store the current top position before updating
    currentTop += (targetTop - currentTop) * smoothingFactor;
    scrollContainer.style.top = `${currentTop}px`;
    applyEffects();
}

function applyMomentum(targetTop, momentum) {
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

    if (Math.abs(currentTop - prevTop) > 0.001) {
        window.requestAnimationFrame(() => onMouseLeave(event));
    } else {
        // Reset the animationStarted flag when the momentum effect has ended
        animationStarted = false;
    }
}

let touchStartY = 0;
let touchMoveThreshold = 10; // Set the threshold in pixels (e.g., 10 pixels)
let isTouchActive = false;

function onTouchStart(event) {
    isTouchActive = true;
    touchStartY = event.touches[0].clientY;
}

function onTouchMove(event) {
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStartY;
    touchStartY = touch.clientY;

    // Only call preventDefault if the user has moved their finger beyond the threshold
    if (Math.abs(deltaY) > touchMoveThreshold) {
        event.preventDefault(); // Prevent scrolling in the background
    }

    const speedMultiplier = 2; // Adjust this value to control the scrolling speed
    const newTop = currentTop + deltaY * speedMultiplier;
    updatePosition(newTop);
}

function onTouchEnd(event) {
    isTouchActive = false;
    onMouseLeave();
}


function applyEffects() {
    const navItems = nav.querySelectorAll('.item-fader');
    const centerY = containerHeight / 2;

    navItems.forEach((navItem) => {
        const navItemRect = navItem.getBoundingClientRect();
        const navContainerRect = navContainer.getBoundingClientRect();
        const navItemCenterY = navItemRect.top + navItemRect.height / 2 - navContainerRect.top;
        const distanceFromCenter = Math.abs(navItemCenterY - centerY);
        const scaleFactor = 1 - (distanceFromCenter / containerHeight * fadeEffectStrength);
        const opacityFactor = Math.max(0, 1 - (distanceFromCenter / (containerHeight / 2) * fadeEffectStrength));

        navItem.style.transform = `scale(${scaleFactor})`;// translateY(-50%)
        navItem.style.opacity = opacityFactor;
    });
}

window.initScrollingMenu = initScrollingMenu;