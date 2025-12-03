from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import glob
import json
import numpy as np

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global configuration variables
IMAGE_DIR = "/localhome/zla247/fs01s_cloth/capture_data/HCI_Activate-light_AprilTag_2/ldr"
SECONDARY_VIDEO_PATH = "/localhome/zla247/Downloads/IMG_3893.mp4"
CAPTURE_LOG_PATH = "/localhome/zla247/fs01s_cloth/capture_data/HCI_Activate_light_AprilTag/capture_log.json"

# Camera-to-gripper transformation
R_c2g = np.array([
    [-7.17667595e-04,  9.99776474e-01,  2.11302413e-02],
    [-4.42126179e-03,  2.11268680e-02, -9.99767027e-01],
    [-9.99989969e-01, -8.10922726e-04,  4.40511146e-03]
])
t_c2g = np.array([3.26272696e-02, -1.61560433e-02, 2.80920856e-02])

# Light-to-gripper transformation
R_l2g = np.array([
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0]
])
t_l2g = np.array([0.0, -0.102, 0.02112])

# Base2 to Base1 transformation (for light arm)
base2_to_base1 = np.array([
    [9.99999959e-01,  2.33227594e-04, -1.69051819e-04,  7.22042468e-03],
    [-2.36740680e-04,  9.99777598e-01, -2.10878871e-02,  8.26339062e-03],
    [1.64095944e-04,  2.10879262e-02,  9.99777611e-01,  3.93500345e-03],
    [0.00000000e+00,  0.00000000e+00,  0.00000000e+00,  1.00000000e+00]
])

def build_4x4(rotation_matrix, translation):
    """Build a 4x4 transformation matrix from rotation and translation."""
    T = np.eye(4)
    T[:3, :3] = np.array(rotation_matrix)
    T[:3, 3] = np.array(translation)
    return T

def compute_poses_from_log():
    """Compute camera and light poses from the capture log."""
    with open(CAPTURE_LOG_PATH, 'r') as f:
        capture_data = json.load(f)
    
    poses = []
    for item in capture_data:
        frame_id = item['id']
        
        # Camera pose computation
        # Gripper-to-base1 (position in mm, convert to meters)
        cam_g2b1 = build_4x4(
            item['camera']['rotation_matrix'],
            [pos / 1000.0 for pos in item['camera']['position']]
        )
        # Camera-to-gripper
        c2g = build_4x4(R_c2g, t_c2g)
        # Camera-to-base1 (world)
        c2w = cam_g2b1 @ c2g
        
        # Light pose computation
        # Gripper-to-base2 (position in mm, convert to meters)
        light_g2b2 = build_4x4(
            item['light']['rotation_matrix'],
            [pos / 1000.0 for pos in item['light']['position']]
        )
        # Light-to-gripper
        l2g = build_4x4(R_l2g, t_l2g)
        # Light-to-base2
        l2b2 = light_g2b2 @ l2g
        # Transform to base1 (world) coordinate
        l2w = base2_to_base1 @ l2b2
        
        # Extract positions (convert to scene units - multiply by 1000 for mm scale in scene)
        camera_pos = (c2w[:3, 3] * 1000).tolist()  # Back to mm for scene
        light_pos = (l2w[:3, 3] * 1000).tolist()
        
        # Extract rotation matrices
        camera_rot = c2w[:3, :3].tolist()
        light_rot = l2w[:3, :3].tolist()
        
        # Transform gripper positions to common world frame (base1)
        # Camera gripper is already in base1
        camera_gripper_pos = [pos for pos in item['camera']['position']]  # Already in mm, base1 frame
        
        # Light gripper is in base2, transform to base1
        light_gripper_b2 = np.array([pos / 1000.0 for pos in item['light']['position']] + [1])
        light_gripper_b1 = base2_to_base1 @ light_gripper_b2
        light_gripper_pos = (light_gripper_b1[:3] * 1000).tolist()  # Convert back to mm
        
        # Get servo angles (joint angles in degrees)
        camera_servo_angles = item['camera'].get('servo_angles', [0, 0, 0, 0, 0, 0, 0])[:6]
        light_servo_angles = item['light'].get('servo_angles', [0, 0, 0, 0, 0, 0, 0])[:6]
        
        poses.append({
            'frame_id': frame_id,
            'camera': {
                'position': camera_pos,
                'rotation': camera_rot,
                'gripper_position': camera_gripper_pos,
                'servo_angles': camera_servo_angles
            },
            'light': {
                'position': light_pos,
                'rotation': light_rot,
                'gripper_position': light_gripper_pos,
                'servo_angles': light_servo_angles
            }
        })
    
    return poses

# Cache the poses on startup
_cached_poses = None

# Mount the image directory to serve static files
app.mount("/images", StaticFiles(directory=IMAGE_DIR), name="images")
app.mount("/assets", StaticFiles(directory="/localhome/zla247/course_projects/HCI/hand_pose_visualizer/frontend"), name="assets")

@app.get("/")
async def read_index():
    return FileResponse("/localhome/zla247/course_projects/HCI/hand_pose_visualizer/frontend/index.html")

@app.get("/api/images")
def get_images():
    """Returns a list of image filenames sorted by name."""
    # Pattern to match png files
    pattern = os.path.join(IMAGE_DIR, "*.png")
    files = glob.glob(pattern)
    # Extract just the filename and sort
    filenames = sorted([os.path.basename(f) for f in files])
    return {"images": filenames}

@app.get("/api/secondary-video")
async def get_secondary_video():
    """Serve the secondary video file."""
    if os.path.exists(SECONDARY_VIDEO_PATH):
        return FileResponse(
            SECONDARY_VIDEO_PATH,
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes"}
        )
    return {"error": "Video not found"}

@app.get("/api/video-info")
def get_video_info():
    """Returns info about the secondary video."""
    return {
        "path": SECONDARY_VIDEO_PATH,
        "exists": os.path.exists(SECONDARY_VIDEO_PATH)
    }

@app.get("/api/poses")
def get_poses():
    """Returns camera and light poses for all frames."""
    global _cached_poses
    if _cached_poses is None:
        _cached_poses = compute_poses_from_log()
    return {"poses": _cached_poses}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
