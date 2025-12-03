document.addEventListener('DOMContentLoaded', () => {
    const videoDisplay = document.getElementById('main-video-display');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const scrubber = document.getElementById('scrubber');
    const frameCounter = document.getElementById('frame-counter');
    const statusFrame = document.getElementById('status-frame');
    const fpsCounter = document.getElementById('fps-counter');
    const secondaryVideo = document.getElementById('secondary-video');

    let images = [];
    let currentIndex = 0;
    let isPlaying = false;
    let animationId = null;
    let lastFrameTime = 0;
    let targetFPS = 1; // Will be recalculated based on video duration
    let frameInterval = 1000 / targetFPS;
    
    // Secondary video sync variables
    let videoDuration = 0; // Duration of secondary video in seconds
    let imagesLoaded = false;
    let videoMetadataLoaded = false;

    // Wait for secondary video to load metadata
    secondaryVideo.addEventListener('loadedmetadata', () => {
        videoDuration = secondaryVideo.duration;
        console.log('Secondary video duration:', videoDuration);
        videoMetadataLoaded = true;
        tryStartPlayback();
    });

    // Check if video metadata is already loaded (in case event fired before listener)
    if (secondaryVideo.readyState >= 1) {
        videoDuration = secondaryVideo.duration;
        console.log('Secondary video already loaded, duration:', videoDuration);
        videoMetadataLoaded = true;
    }

    function calculateFPS() {
        if (images.length > 0 && videoDuration > 0) {
            // Calculate FPS so main video duration matches secondary video duration
            // FPS = number_of_images / video_duration
            targetFPS = images.length / videoDuration;
            frameInterval = 1000 / targetFPS;
            // Secondary video plays at normal speed (1x)
            secondaryVideo.playbackRate = 1;
            console.log('Video duration:', videoDuration, 'seconds, Images:', images.length, 'Main FPS:', targetFPS.toFixed(3), 'Frame interval:', frameInterval.toFixed(1), 'ms');
        }
    }

    function tryStartPlayback() {
        // Only start when both images and video metadata are loaded
        if (imagesLoaded && videoMetadataLoaded) {
            calculateFPS();
            startPlayback();
        }
    }

    // Fetch images from backend
    fetch('/api/images')
        .then(response => response.json())
        .then(data => {
            images = data.images;
            if (images.length > 0) {
                scrubber.max = images.length - 1;
                updateDisplay(0);
                imagesLoaded = true;
                tryStartPlayback();
            }
        })
        .catch(err => console.error('Error fetching images:', err));

    function updateDisplay(index) {
        if (images.length === 0) return;

        currentIndex = index;
        const filename = images[currentIndex];
        videoDisplay.src = `/images/${filename}`;

        // Update UI
        scrubber.value = currentIndex;
        frameCounter.textContent = `${currentIndex + 1} / ${images.length}`;
        statusFrame.textContent = currentIndex + 1;

        // Sync secondary video position
        syncSecondaryVideo();

        // Update 3D scene
        if (window.scene3d) {
            window.scene3d.updateFrame(currentIndex);
        }
    }

    function syncSecondaryVideo() {
        if (videoDuration > 0 && images.length > 0) {
            // Calculate the progress (0 to 1) of the main video
            const progress = currentIndex / (images.length - 1);
            // Set secondary video to corresponding position
            const targetTime = progress * videoDuration;
            
            // Only seek if difference is significant (avoid constant seeking)
            if (Math.abs(secondaryVideo.currentTime - targetTime) > 0.5) {
                secondaryVideo.currentTime = targetTime;
            }
        }
    }

    function startPlayback() {
        if (isPlaying) return;
        isPlaying = true;
        playPauseBtn.textContent = 'Pause';
        lastFrameTime = performance.now();
        
        // Start secondary video
        secondaryVideo.play().catch(e => console.log('Video play error:', e));
        
        loop();
    }

    function pausePlayback() {
        isPlaying = false;
        playPauseBtn.textContent = 'Play';
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        // Pause secondary video
        secondaryVideo.pause();
    }

    function loop(currentTime) {
        if (!isPlaying) return;

        animationId = requestAnimationFrame(loop);

        const elapsed = currentTime - lastFrameTime;

        if (elapsed > frameInterval) {
            lastFrameTime = currentTime - (elapsed % frameInterval);

            // Calculate actual FPS
            const fps = Math.round(1000 / elapsed);
            fpsCounter.textContent = fps;

            let nextIndex = currentIndex + 1;
            if (nextIndex >= images.length) {
                nextIndex = 0; // Loop
                // Reset secondary video to start
                secondaryVideo.currentTime = 0;
            }
            updateDisplay(nextIndex);
        }
    }

    // Event Listeners
    playPauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            pausePlayback();
        } else {
            startPlayback();
        }
    });

    scrubber.addEventListener('input', (e) => {
        pausePlayback();
        updateDisplay(parseInt(e.target.value));
    });
});
