if ('serviceWorker' in navigator) {
    console.log('Service Workers supported by browser');
} else {
    // Service Workers are NOT supported
    alert('This app might not work properly in your environment due to restrictions. Please contact your IT department.');
}



function initNavbar() {
    var navbar = document.querySelector('.sidebarController');
    var icon = document.querySelector('.icon');
    var content = document.querySelector('.content');
    var main = document.querySelector('.topBlock');
    var mq = window.matchMedia('(max-width: 10000px)');
    var topRow = document.querySelector('.top-row');
    var smallNavBar = document.querySelector('.smallNavBar');
    // Set initial state based on screen size
    //if (mq.matches) {
    //    navbar.classList.add('navHider');
    //    icon.classList.remove('rotateLeft');
    //    icon.classList.add('rotateRight');
    //} else {
    //    navbar.classList.add('navShower');
    //    icon.classList.remove('rotateRight');
    //    icon.classList.add('rotateLeft');
    //}

    // Listen for clicks on the icon
    icon.addEventListener('click', function () {
        if (navbar.classList.contains('navShower')) {
            navbar.classList.remove('navShower');
            navbar.classList.remove('sidebarController-max');
            navbar.classList.add('navHider');
            icon.classList.remove('rotateLeft');
            icon.classList.add('rotateRight');
            content.classList.remove('contentHider');
            main.classList.remove('main-Nav-Open');
            main.classList.add('main-Nav-Closed');
            topRow.classList.remove("top-row-menu-open")
            smallNavBar.classList.add("showSmallNavBar");
            smallNavBar.classList.remove("noSmallNavBar");
        } else {
            navbar.classList.remove('sidebarController-start');
            navbar.classList.remove('navHider');
            navbar.classList.add('navShower');
            navbar.classList.add('sidebarController-max');
            icon.classList.remove('rotateRight');
            icon.classList.add('rotateLeft');
            content.classList.add('contentHider');
            main.classList.add('main-Nav-Open');
            main.classList.remove('main-Nav-Closed');
            topRow.classList.add("top-row-menu-open")
            smallNavBar.classList.remove("showSmallNavBar");
            smallNavBar.classList.add("noSmallNavBar");
        }
        triggerRecalculateSizes();
    });

    // Listen for screen size changes
    mq.addListener(function () {
        if (mq.matches) {
            navbar.classList.remove('navShower');
            navbar.classList.remove('sidebarController-max');
            navbar.classList.add('navHider');
            icon.classList.remove('rotateLeft');
            icon.classList.add('rotateRight');
        } else {
            navbar.classList.remove('navHider');
            navbar.classList.add('navShower');
            navbar.classList.add('sidebarController-max');
            icon.classList.remove('rotateRight');
            icon.classList.add('rotateLeft');
        }
    });
}

function initNavbarMobile() {
    var navbar = document.querySelector('.sidebarController');
    var links = document.querySelectorAll('.lastLink');
    var icon = document.querySelector('.icon');
    var content = document.querySelector('.content');
    var main = document.querySelector('.topBlock');
    links.forEach(function (link) {
        // Listen for clicks on the link
        link.addEventListener('click', function () {
            if (navbar.classList.contains('navShower') && window.innerWidth < 690) {
                navbar.classList.remove('navShower');
                navbar.classList.remove('sidebarController-max');
                navbar.classList.add('navHider');
                icon.classList.remove('rotateLeft');
                icon.classList.add('rotateRight');
                content.classList.remove('contentHider');
                main.classList.remove('main-Nav-Open');
                main.classList.add('main-Nav-Closed');
                topRow.classList.remove("top-row-menu-open")
                smallNavBar.classList.remove("showSmallNavBar");
                smallNavBar.classList.add("noSmallNavBar");
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

//Divs and containers
let navContainer, nav, popupTip;
//Flags
let isMouseOverNav, isTouchActive, animationStarted, hasBouncedTop, hasBouncedBottom = false;
//Positions
let currentTop = 0, prevTop = 0, startY = 0, startX = 0;
//Shared vars
let maxTop, containerHeight, navHeight, navItemsHeight, initialY, tooltipTimeout, navItemsContainer;
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let interval = null;
//Control variables:
const momentumFactor = 0.95;
const bounceFactor = 0.5;
const maxSpeed = 0.26;
const smoothingFactor = 0.05;

function initScrollingMenu(navContainerSelector, navSelector) {
    navContainer = document.querySelector(navContainerSelector);
    nav = document.querySelector(navSelector);
    popupTip = document.querySelector('#popupTip');

    navContainer.addEventListener("mouseenter", onMouseEnter);
    navContainer.addEventListener("mousemove", onMouseMove);
    navContainer.addEventListener("mouseleave", onMouseLeave);
    navContainer.addEventListener("touchstart", onTouchStart, { passive: true });
    navContainer.addEventListener("touchend", onTouchEnd, { passive: true });
    const intervals = new Map();

    let hackerAnimations = document.querySelectorAll(".hackerAnimation");

    hackerAnimations.forEach(element => {
        element.addEventListener('mouseover', event => {
            let iteration = 0;
            const elementId = event.target.dataset.id;

            if (intervals.has(elementId)) {
                clearInterval(intervals.get(elementId));
                intervals.delete(elementId);
            }

            const intervalId = setInterval(() => {
                event.target.innerText = event.target.innerText
                    .split("")
                    .map((letter, index) => {
                        if (index < iteration) {
                            return event.target.dataset.value[index];
                        }

                        return letters[Math.floor(Math.random() * 26)];
                    })
                    .join("");

                if (iteration >= event.target.dataset.value.length) {
                    clearInterval(intervalId);
                    intervals.delete(elementId);
                }

                iteration += 1 / 3;
            }, 30);

            intervals.set(elementId, intervalId);
        });
    });

    setTimeout(() => {
        navItemsContainer = nav.querySelector('.nav-items-container');

        //containerHeight = navContainer.offsetHeight;
        //navHeight = nav.offsetHeight;
        //navItemsHeight = navItemsContainer.offsetHeight;
        //maxTop = containerHeight - ((navHeight * 3) / 2);
        //removed this for now as it causes the nav bar to jump up and down when a section is expanded.  I might need to switch back to my logic that resets the starting position to the first mouse Y pos.
        //currentTop = ((containerHeight - navItemsHeight) / 2) + 110; // Update currentTop calculation
        //nav.style.top = `${currentTop}px`;
    }, 500); // Set the delay time in milliseconds (e.g., 500ms)
}

function calculateScrollSpeed(mouseY, startY) {
    const distanceToStart = Math.abs(mouseY - startY);
    const speed = distanceToStart / containerHeight;

    if (speed > maxSpeed) {
        return maxSpeed;
    }

    return speed;
}

const clearAnimationIntervals = (intervals) => {
    intervals.forEach(interval => clearInterval(interval));
    intervals.clear();
}

function onMouseEnter(event) {
    if (isTouchActive) { return };
    containerHeight = navContainer.offsetHeight;
    navHeight = nav.offsetHeight;
    navItemsHeight = navItemsContainer.offsetHeight;
    maxTop = containerHeight - ((navHeight * 3) / 2);
    const navContainerRect = navContainer.getBoundingClientRect();
    //startY = event.clientY - navContainerRect.top;
    startY = containerHeight/2;
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
    const viewportHeight = window.innerHeight - 56;
    if (navHeight <= viewportHeight) {
        isMouseOverNav = false;
        return;  // if navHeight is not greater than viewportHeight, return.
    }
    const mouseY = event.clientY - navContainerRect.top;
    const scrollPosition = (mouseY - startY) / (viewportHeight / 2);
    // Calculate scrolling speed based on the mouse position
    const speed = calculateScrollSpeed(mouseY, startY);
    const newTop = maxTop * scrollPosition * speed - (navHeight - viewportHeight) / 2;

    updatePosition(newTop);

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

function updatePosition(targetTop) {
    if (isTouchActive) { return };
    const viewportHeight = window.innerHeight - 56;
    if (navHeight <= viewportHeight) {
        return;
    }
    prevTop = currentTop; // Store the current top position before updating

    // Calculate the new position
    let newTop = currentTop + (targetTop - currentTop) * smoothingFactor;

    // Adjust the target position if the new position is beyond the top boundary
    if (newTop > 0 && !hasBouncedTop && !isMouseOverNav) {
        targetTop = currentTop - Math.abs(newTop) * (bounceFactor + 0.2);
        hasBouncedTop = true;
    }

    // Adjust the target position if the new position is beyond the bottom boundary
    if (newTop < window.innerHeight - navHeight - 56 && !hasBouncedBottom && !isMouseOverNav) {
        targetTop = currentTop - (newTop - (window.innerHeight - navHeight)) * bounceFactor;
        hasBouncedBottom = true;
    }

    // Recalculate the new position with the adjusted target position
    newTop = currentTop + (targetTop - currentTop) * smoothingFactor;

    currentTop = newTop;
    nav.style.top = `${currentTop}px`;
}


function applyMomentum(targetTop, momentum) {
    if (isTouchActive) { return };
    if (Math.abs(momentum) < 0.001) {
        return targetTop;
    } else {
        hasBouncedTop = false;
        hasBouncedBottom = false;
    }

    const newTargetTop = targetTop + momentum;
    const newMomentum = momentum * momentumFactor;

    return applyMomentum(newTargetTop, newMomentum);
}

function onMouseLeave(event) {
    if (isTouchActive) { return };
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
    popupTip.style.display = 'none';  // Hide the tooltip when the mouse leaves the navbar
}

let touchEndTimeout = null;

function onTouchStart(event) {
    clearTimeout(touchEndTimeout);
    isTouchActive = true;
    navContainer.classList.remove("nav-container-no-touch");
    navContainer.classList.add("nav-container-touch");
}

function onTouchEnd(event) {
    touchEndTimeout = setTimeout(() => {
        navContainer.classList.remove("nav-container-touch");
        navContainer.classList.add("nav-container-no-touch");
        isTouchActive = false;
    }, 500);
}

window.initScrollingMenu = initScrollingMenu;