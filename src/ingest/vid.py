import time
from google import genai
from google.genai import types
import markdown

client = genai.Client(api_key="")

MODEL_ID="gemini-3.7-flash"

def upload_video(video_file_name):
  print(f"Uploading {video_file_name}...")
  video_file = client.files.upload(file=video_file_name)

  # BUG FIX: Use .state.name instead of .state, and wait until it is ACTIVE 
  while video_file.state.name != "ACTIVE":
      print(f'Current state: {video_file.state.name} - Waiting for video to be processed...')
      time.sleep(5)
      
      # Ping the API to refresh the object
      video_file = client.files.get(name=video_file.name)
      
      # Catch the failure with the exact error message
      if video_file.state.name == "FAILED":
          raise ValueError(f"Video processing failed. Reason: {video_file.error}")

  print(f'Video processing complete: {video_file.uri}')
  return video_file

# FIX: Use the clean, H.264 re-encoded video, NOT the raw output.mp4
video_file = upload_video('../../data/videos/output.mp4')

prompt = "For each scene in this video, generate captions that describe the scene. Place each caption into an object with the timecode of the caption in the video." 

print("Prompting the Interactions API...")

interaction = client.interactions.create(
    model=MODEL_ID,
    input=[
        {"type": "document", "uri": video_file.uri},
        {"type": "text", "text": prompt},
    ],
)

# Print the final text to the terminal
print("\n--- CAPTIONS ---")
print(interaction.steps[-1].content[0].text)
