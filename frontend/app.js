// ============================================
// GLOBAL PLAYBACK CONFIGURATION
// ============================================
// Set the total playback time in seconds
// Both main video (images) and reference video will be synced to this duration
window.totalPlaybackTime = 30;  // Total playback time in seconds
// ============================================

// ============================================
// GLOBAL WARNING CONFIGURATION
// ============================================
// Set the warning text and frame range here
// The warning will be displayed when currentFrame is within [startFrame, endFrame]
// Frame numbers are 1-based (first frame is 1, not 0)
window.warningConfig = {
    text: "AprilTag is near the corner, keep it within the camera view!",
    startFrame: 38,  // Warning starts at frame 30
    endFrame: 29     // Warning ends at frame 60
};
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const videoDisplay = document.getElementById('main-video-display');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const statusFrame = document.getElementById('status-frame');
    const warningLine = document.getElementById('warning-line');
    const systemStatus = document.getElementById('system-status');
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
        const totalTime = window.totalPlaybackTime || 30; // Default 30 seconds
        
        if (images.length > 0) {
            // Calculate FPS based on total playback time
            // FPS = number_of_images / totalPlaybackTime
            targetFPS = images.length / totalTime;
            frameInterval = 1000 / targetFPS;
            
            // Adjust secondary video playback rate to match total time
            if (videoDuration > 0) {
                // playbackRate = videoDuration / totalPlaybackTime
                secondaryVideo.playbackRate = videoDuration / totalTime;
            }
            
            console.log('Total playback time:', totalTime, 'seconds');
            console.log('Images:', images.length, 'Main FPS:', targetFPS.toFixed(3));
            console.log('Video duration:', videoDuration, 'Playback rate:', secondaryVideo.playbackRate.toFixed(3));
        }
    }

    function tryStartPlayback() {
        // Only start when both images and video metadata are loaded
        if (imagesLoaded && videoMetadataLoaded) {
            calculateFPS();
            startPlayback();
        }
    }

    // Check if current frame is within warning range
    function isInWarningRange(frameNumber) {
        const config = window.warningConfig;
        if (!config || !config.text) return false;
        return frameNumber >= config.startFrame && frameNumber <= config.endFrame;
    }

    // Update warning display based on current frame
    function updateWarningDisplay(frameNumber) {
        const config = window.warningConfig;
        
        if (isInWarningRange(frameNumber)) {
            // Show warning
            warningLine.textContent = config.text;
            systemStatus.textContent = 'Warning';
            systemStatus.className = 'value warning';
        } else {
            // Clear warning
            warningLine.textContent = '';
            systemStatus.textContent = 'Ready';
            systemStatus.className = 'value ready';
        }
    }

    // Fetch images from backend
    fetch('/api/images')
        .then(response => response.json())
        .then(data => {
            images = data.images;
            if (images.length > 0) {
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
        // Add cache buster to prevent loading old cached images
        videoDisplay.src = `/images/${filename}?v=${Date.now()}`;

        // Frame number is 1-based for display
        const frameNumber = currentIndex + 1;

        // Update UI
        statusFrame.textContent = frameNumber;

        // Update warning display
        updateWarningDisplay(frameNumber);

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
        playPauseBtn.textContent = 'Start';
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
});
