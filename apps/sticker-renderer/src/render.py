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
    
    # Pre-calculate sizes for speed and stability
    buffer_size = width * height * 4
    bytes_per_line = width * 4
    
    sys.stderr.write(f"Rendering {render_frames} frames at {width}x{height} (buffer={buffer_size}, stride={bytes_per_line})\n")
    
    for i in range(render_frames):
        # Call with explicit positional arguments for EVERYTHING
        # frame_num, buffer_size, width, height, bytes_per_line
        try:
            buffer = anim.lottie_animation_render(i, buffer_size, width, height, bytes_per_line)
            if buffer:
                sys.stdout.buffer.write(buffer)
                sys.stdout.buffer.flush()
        except Exception as e:
            sys.stderr.write(f"Error rendering frame {i}: {str(e)}\n")
            break

if __name__ == "__main__":
    render()
