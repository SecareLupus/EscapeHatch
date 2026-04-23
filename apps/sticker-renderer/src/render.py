import sys
import json
try:
    import rlottie
except ImportError:
    import rlottie_python as rlottie
import io

def render():
    # Load Lottie JSON from stdin
    try:
        lottie_data = sys.stdin.read()
        anim = rlottie.LottieAnimation.from_data(lottie_data)
    except Exception as e:
        sys.stderr.write(f"Error loading Lottie: {str(e)}\n")
        sys.exit(1)

    width, height = 160, 160
    total_frames = anim.lottie_animation_get_totalframe()
    render_frames = min(total_frames, 60)
    sys.stderr.write(f"Total frames: {total_frames}, Rendering: {render_frames}\n")
    
    for i in range(render_frames):
        # The documentation shows lottie_animation_render(frame_num=i) returns a BGRA buffer
        buffer = anim.lottie_animation_render(i)
        if buffer:
            # We need to write the raw bytes to stdout
            # FFmpeg is expecting raw BGRA frames
            sys.stdout.buffer.write(buffer)
            sys.stdout.buffer.flush()

if __name__ == "__main__":
    render()
