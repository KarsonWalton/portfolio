document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // 2. Active Section ScrollSpy Effect
    const sections = document.querySelectorAll('section[id], footer[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    const updateActiveNav = () => {
        let currentSectionId = '';
        const scrollPosition = window.scrollY + 200;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute('id');
            }
        });

        // Special check if reached bottom of page -> activate Contact
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
            currentSectionId = 'contact-info';
        }

        navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href').substring(1);
            if (href === currentSectionId || (href === 'resume-footer' && currentSectionId === 'contact-info')) {
                link.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav(); // Initial call

    // 3. Three.js Interactive 3D Canvas Scene
    initThreeJS();

    // 4. GSAP Scroll Trigger Animations
    initGSAPAnimations();
});

/* ==========================================================================
   THREE.JS INTERACTIVE MODEL CANVAS
   ========================================================================== */
function initThreeJS() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 6); // Initial camera position

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x1B3B2B, 0.8);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // GLTF + DRACO Loader Setup
    const gltfLoader = new THREE.GLTFLoader();
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
    gltfLoader.setDRACOLoader(dracoLoader);

    const models = [
        {
            name: "rocket-assembly",
            title: "01 / Rocket Assembly",
            subtitle: "High-Power Rocketry System",
            targetSize: 3.6
        },
        {
            name: "collapsible-box",
            title: "02 / Collapsible Box",
            subtitle: "Sustainable Packaging Design",
            targetSize: 2.2
        },
        {
            name: "arduino-component-box",
            title: "03 / Arduino Component Box",
            subtitle: "Custom Enclosure Assembly",
            targetSize: 2.2
        }
    ];

    let currentModelIndex = 0;
    let currentView = "full";
    let activeLoadedMesh = null;
    let loadRequestId = 0; // Request token to prevent async race conditions

    function loadModel(index, view) {
        const requestId = ++loadRequestId;
        const modelData = models[index];
        const primaryFile = `./assets/models/${modelData.name}.glb`;
        const explodedFile = `./assets/models/${modelData.name}-exploded.glb`;
        const filePath = (view === 'exploded') ? explodedFile : primaryFile;

        // Reset rotation and completely purge old geometry from scene
        modelGroup.rotation.set(0, 0, 0);
        modelGroup.clear();
        activeLoadedMesh = null;

        gltfLoader.load(
            filePath,
            (gltf) => {
                // Cancel if a newer load request was initiated while downloading
                if (requestId !== loadRequestId) return;

                activeLoadedMesh = gltf.scene;

                // 1. Orient Onshape Z-Up coordinate system to Three.js Y-Up
                activeLoadedMesh.rotation.x = -Math.PI / 2;
                activeLoadedMesh.position.set(0, 0, 0);
                activeLoadedMesh.scale.set(1, 1, 1);
                activeLoadedMesh.updateMatrixWorld(true);

                // 2. Scale first based on unscaled bounding dimensions
                let box = new THREE.Box3().setFromObject(activeLoadedMesh);
                let size = box.getSize(new THREE.Vector3());
                let maxDim = Math.max(size.x, size.y, size.z);

                if (maxDim > 0) {
                    const target = modelData.targetSize || 2.5;
                    const scale = target / maxDim;
                    activeLoadedMesh.scale.set(scale, scale, scale);
                }

                // 3. Re-evaluate matrices and center AFTER scaling
                activeLoadedMesh.updateMatrixWorld(true);
                box.setFromObject(activeLoadedMesh);
                const center = box.getCenter(new THREE.Vector3());
                activeLoadedMesh.position.sub(center);

                modelGroup.add(activeLoadedMesh);
            },
            undefined,
            (error) => {
                if (requestId !== loadRequestId) return;
                console.warn(`Could not load ${filePath}. Falling back...`);
                if (view === 'exploded') {
                    loadModel(index, 'full');
                }
            }
        );

        // Update UI Tag Text
        const titleEl = document.getElementById('nametag-title');
        const subEl = document.getElementById('nametag-sub');
        if (titleEl) titleEl.textContent = modelData.title;
        if (subEl) subEl.textContent = `${modelData.subtitle} (${view === 'exploded' ? 'Exploded View' : 'Assembled'})`;
    }

    loadModel(currentModelIndex, currentView);

    // Button Switchers
    document.querySelectorAll('.model-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentModelIndex = parseInt(btn.getAttribute('data-model'), 10);
            loadModel(currentModelIndex, currentView);
        });
    });

    document.querySelectorAll('.view-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.getAttribute('data-view');
            loadModel(currentModelIndex, currentView);
        });
    });

    // Viewport Resizing
    const updateSize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);
    updateSize();

    // Mouse Controls (Rotation)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    container.addEventListener('mousedown', () => { isDragging = true; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    container.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            modelGroup.rotation.y += deltaX * 0.01;
            modelGroup.rotation.x += deltaY * 0.01;
        }
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    // Scroll Wheel Zoom (Inner Active Region Only)
container.addEventListener('wheel', (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Define edge padding (15% on sides, 15% on top/bottom)
    const marginX = rect.width * 0.15;
    const marginY = rect.height * 0.15;

    // If cursor is in the outer margin area, allow standard page scrolling
    const isNearEdge = x < marginX || x > (rect.width - marginX) || y < marginY || y > (rect.height - marginY);
    if (isNearEdge) {
        return; 
    }

    e.preventDefault(); // Intercept scroll for zooming only in the center zone

    const zoomSpeed = 0.0035;
    const minDistance = 1.8;
    const maxDistance = 12.0;

    camera.position.z += e.deltaY * zoomSpeed;
    camera.position.z = Math.max(minDistance, Math.min(maxDistance, camera.position.z));
}, { passive: false });

    function animate() {
        requestAnimationFrame(animate);
        if (!isDragging) {
            modelGroup.rotation.y += 0.003;
        }
        renderer.render(scene, camera);
    }
    animate();
}

/* ==========================================================================
   GSAP SCROLL REVEAL ANIMATIONS
   ========================================================================== */
function initGSAPAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const reveals = document.querySelectorAll('.gsap-reveal');
    reveals.forEach((element) => {
        gsap.fromTo(
            element,
            { opacity: 0, y: 40 },
            {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: element,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });
}

/* ==========================================================================
   PROJECT MODAL DATA & CONTROLLER
   ========================================================================== */

// --- Updated Project Data Dictionary (Simplified & Professional Summaries) ---
const projectsData = [
    {
        title: "Collapsible Shipping Box",
        subtitle: "Design I Cornerstone Project",
        media: [
            { type: "image", src: "assets/images/box-photo1.png", alt: "Box CAD view" },
            { type: "image", src: "assets/images/box-photo2.jpg", alt: "Box expanded view" }
        ],
        summary: "Developed as part of the Design I Cornerstone curriculum at Colorado School of Mines, this project addressed the high costs and wasted space associated with shipping empty containers back to their origin. To solve this problem, our team engineered a reusable and collapsible shipping box to minimize return transport volume. The core mechanism relies on a custom 3D printed spring-piston design that operates on a specialized hinge system. This rigid structure is paired with a flexible outer shell, which ensures the container remains weather resistant and structurally sound to protect cargo. When emptied, the user can actuate the folding joints to allow the box to collapse flat. Throughout the design process, we utilized Onshape for CAD modeling and ran kinematic simulations to ensure smooth folding operations. We also completed multiple rapid prototyping iterations using PLA and PETG to optimize the strength to weight ratio. The final prototype demonstrated a scalable packaging alternative that could reduce operational costs and save space in commercial supply chains."
    },
    {
        title: "Mycelium Biomass Waste Research",
        subtitle: "Innov8x Challenge",
        media: [
            { 
                type: "slider", 
                slides: [
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction.png", alt: "Slide 1 - Title" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (1).png", alt: "Slide 2" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (2).png", alt: "Slide 3" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (3).png", alt: "Slide 4" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (4).png", alt: "Slide 5" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (5).png", alt: "Slide 6" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (6).png", alt: "Slide 7" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (7).png", alt: "Slide 8" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (8).png", alt: "Slide 9" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (9).png", alt: "Slide 10" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (10).png", alt: "Slide 11" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (11).png", alt: "Slide 12" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (12).png", alt: "Slide 13" },
                    { src: "assets/slides/Mycelium Bricks_ Bio-Fabricated Construction (13).png", alt: "Slide 14 - Thank You" }
                ]
            }
        ],
        summary: "Originating from the Innov8x Challenge, this interdisciplinary research project explored bio-fabrication techniques to address severe wildfire risks in Colorado caused by the accumulation of forest biomass. Our team investigated the use of fungal mycelium as a natural bio-binder capable of transforming forest floor debris, like dead wood and pine needles, into fire resistant structural materials. Rather than growing our own physical prototypes, we conducted an extensive review of existing mycelium research and prior industry case studies to evaluate the viability of the material. The reviewed data showed these materials to be lightweight, structurally sound, and inherently flame retardant. Following the material science review, we conducted market and logistical research to develop a comprehensive implementation strategy. We evaluated the scalability of this solution for local forest management initiatives and calculated potential reductions in wildfire fuel loads. The project culminated in a formal feasibility pitch presented directly to the Jefferson County Fire Department, forestry experts, and municipal leadership. We proposed a shift from controlled burns to mycelium bio-cycling to help manage forest waste."
    },
    {
        title: "L1/L2 High-Power Rocket ('Starry Night')",
        subtitle: "Tripoli High-Power Certifications",
        media: [
            { type: "video", src: "assets/videos/starry-night-launch.mov", alt: "Starry Night launch video" },
            { type: "image", src: "assets/images/starry-night-retrieval.jpeg", alt: "Rocket on the launch pad" }
        ],
        summary: "The Starry Night project focused on high-power rocketry engineering. The rocket was designed and constructed to achieve both Level 1 and Level 2 certifications through the Tripoli Rocketry Association. Development began with flight physics simulations using OpenRocket. I modeled the airframe, computed the center of pressure and center of gravity margins to ensure stable flight, and simulated various motor classifications to predict apogee, velocity, and deployment timing. The physical construction utilized fiberglass composites, motor mount tubes, and specialized epoxy to withstand aerodynamic stresses. The recovery system was ground tested to ensure reliable parachute deployment at apogee. On launch day, the first flight successfully secured my Level 1 certification. The subsequent Level 2 certification flight took place at a later date on a more powerful motor, pushing the airframe to higher altitudes and velocities. A key success of this build was that the rocket required no modifications, repairs, or structural changes between the two launches, resulting in a successful recovery both times."
    },
    {
        title: "'JEFF' High-Power Rocket",
        subtitle: "Supersonic High-Altitude Flight",
        media: [
            { type: "image", src: "assets/images/jeff-rocket-1.jpeg", alt: "JEFF airframe" },
            { type: "image", src: "assets/images/jeff-rocket-2.png", alt: "JEFF avionics bay" }
        ],
        summary: "The JEFF high-power rocket is being built to break the sound barrier and reach an apogee of approximately 10,000 feet. Powered by a K-class solid propellant motor, the rocket was designed with an emphasis on aerodynamic efficiency and structural integrity to survive supersonic flight. A key component of this build was the implementation of a dual deployment recovery system. To prevent the rocket from drifting far from the launch pad on descent, a small drogue parachute deploys at apogee. This allows the rocket to fall rapidly but stably. Once it descends to 1,000 feet, the main parachute deploys for a soft touchdown. This sequence is controlled by an onboard Eggtimer flight computer. For this system, I designed and 3D printed a custom and modular avionics bay to safely house the altimeters, independent battery systems, and black powder deployment charges. This allowed for the capture of onboard flight footage while minimizing drag, culminating in a successful supersonic flight."
    }
];

// --- Modal State & DOM Elements ---
let currentProjectIndex = 0;

function getElement(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Warning: Element with ID "${id}" was not found in the HTML.`);
    return el;
}

const modalOverlay = getElement('project-modal');
const closeBtn = getElement('modal-close');
const modalTitle = getElement('modal-title');
const modalHero = getElement('modal-hero-image');
const modalDesc = getElement('modal-long-description');
const prevBtn = getElement('modal-prev');
const nextBtn = getElement('modal-next');
const prevLabel = getElement('prev-project-label');
const nextLabel = getElement('next-project-label');
const projectCards = document.querySelectorAll('.project-card');

function openModal(index) {
    if (!modalOverlay) return;
    currentProjectIndex = index;
    updateModalContent();
    
    modalOverlay.setAttribute('aria-hidden', 'false');
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.setAttribute('aria-hidden', 'true');
    modalOverlay.classList.remove('active');
    document.body.style.overflow = ''; 
}

// --- Global Lightbox Setup ---
const lightboxOverlay = document.createElement('div');
lightboxOverlay.className = 'lightbox-overlay';
document.body.appendChild(lightboxOverlay);

// Close lightbox when clicking anywhere on the background
lightboxOverlay.addEventListener('click', (e) => {
    // If they click on a video, let them use the video controls without closing
    if (e.target.tagName !== 'VIDEO') {
        lightboxOverlay.classList.remove('active');
        setTimeout(() => { lightboxOverlay.innerHTML = ''; }, 300); // Clear memory after fade out
    }
});

// --- Updated Content Injector Function ---
function updateModalContent() {
    if (typeof projectsData === 'undefined') return;
    
    const project = projectsData[currentProjectIndex];
    if (!project) return;
    
    if (modalTitle) modalTitle.textContent = project.title;

    // Build the dynamic media header
    const mediaHeader = document.querySelector('.modal-media-header');
    if (mediaHeader && project.media) {
        let mediaHTML = '';
        
        project.media.forEach((item) => {
            if (item.type === 'image') {
                mediaHTML += `
                    <div class="modal-media-item">
                        <img src="${item.src}" alt="${item.alt}" onerror="this.parentElement.style.display='none'">
                    </div>
                `;
            } else if (item.type === 'video') {
                mediaHTML += `
                    <div class="modal-media-item">
                        <video src="${item.src}" controls playsinline></video>
                    </div>
                `;
            } else if (item.type === 'slider') {
                const slidesHTML = item.slides.map((slide, i) => `
                    <img src="${slide.src}" alt="${slide.alt}" class="slide-image ${i === 0 ? 'active' : ''}">
                `).join('');
                
                mediaHTML += `
                    <div class="modal-media-item presentation-slider">
                        <div class="slider-track">${slidesHTML}</div>
                        <button class="slider-btn prev-btn" aria-label="Previous Slide">❮</button>
                        <button class="slider-btn next-btn" aria-label="Next Slide">❯</button>
                        <div class="slide-counter">1 / ${item.slides.length}</div>
                    </div>
                `;
            }
        });
        
        mediaHeader.innerHTML = mediaHTML;

        // Initialize slider logic
        const slider = mediaHeader.querySelector('.presentation-slider');
        if (slider) {
            let currentSlide = 0;
            const slides = slider.querySelectorAll('.slide-image');
            const counter = slider.querySelector('.slide-counter');
            
            const showSlide = (index) => {
                slides.forEach(s => s.classList.remove('active'));
                if (index >= slides.length) currentSlide = 0;
                if (index < 0) currentSlide = slides.length - 1;
                slides[currentSlide].classList.add('active');
                counter.textContent = `${currentSlide + 1} / ${slides.length}`;
            };

            slider.querySelector('.prev-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents triggering lightbox
                currentSlide--; showSlide(currentSlide);
            });
            slider.querySelector('.next-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents triggering lightbox
                currentSlide++; showSlide(currentSlide);
            });
        }

       // --- NEW: Attach Fullscreen Lightbox logic ONLY to images ---
        const allImageElements = mediaHeader.querySelectorAll('img');
        allImageElements.forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't close the main project modal
                
                // If it's a presentation slider, only expand the slide currently being viewed
                if (img.classList.contains('slide-image') && !img.classList.contains('active')) return;

                const clone = img.cloneNode(true);
                clone.className = 'lightbox-content';

                lightboxOverlay.innerHTML = ''; // Clear previous
                lightboxOverlay.appendChild(clone);
                lightboxOverlay.classList.add('active');
            });
        });
    }

    if (modalDesc) {
        modalDesc.innerHTML = `
            <div class="modal-summary-section">
                <p><strong>Summary:</strong> ${project.summary}</p>
            </div>
        `;
    }

    const prevIndex = (currentProjectIndex === 0) ? projectsData.length - 1 : currentProjectIndex - 1;
    const nextIndex = (currentProjectIndex === projectsData.length - 1) ? 0 : currentProjectIndex + 1;
    
    if (prevLabel) prevLabel.textContent = projectsData[prevIndex].title;
    if (nextLabel) nextLabel.textContent = projectsData[nextIndex].title;
}

// Attach Event Listeners
projectCards.forEach((card, index) => {
    card.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(index);
    });
});

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        currentProjectIndex = (currentProjectIndex === 0) ? projectsData.length - 1 : currentProjectIndex - 1;
        updateModalContent();
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        currentProjectIndex = (currentProjectIndex === projectsData.length - 1) ? 0 : currentProjectIndex + 1;
        updateModalContent();
    });
}

if (closeBtn) closeBtn.addEventListener('click', closeModal);

if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.getAttribute('aria-hidden') === 'false') {
        closeModal();
    }
});