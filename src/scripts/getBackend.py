import platform

def get_optimal_backend():
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass

    if platform.system() == "Darwin" and platform.machine() == "arm64":
        return "apple_silicon"

    return "cpu"
