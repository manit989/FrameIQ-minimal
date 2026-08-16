from pydantic import BaseModel

class InputVideo(BaseModel):
    audio_path : str
    video_path: str
    title: str
    description: str


