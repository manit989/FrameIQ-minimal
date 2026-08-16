from faster_whisper import WhisperModel

model_size = "large-v2"

# Run on GPU with FP16 apne hardware k hisab se ise change kr lena
model = WhisperModel(model_size, device="cpu", compute_type="float16")

segments, info = model.transcribe("../../data/videos/output.mp3", beam_size=5)

print("Detected language '%s' with probability %f" % (info.language, info.language_probability))

for segment in segments:
    print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))

