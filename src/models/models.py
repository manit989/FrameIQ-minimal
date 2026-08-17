from pydantic import BaseModel, Field

class SceneCaption(BaseModel):
    timestamp_seconds: float = Field(description="Timestamp in seconds")
    timestamp_formatted: str = Field(description="Formatted timecode (e.g. 00:01:15)")
    description: str = Field(description="Scene description from Gemini")
    snapshot_url: str | None = Field(default=None, description="Static HTTP URL to snapshot image")

class VideoAnalysisRequest(BaseModel):
    # Only ask for the video; the system handles the rest
    video_filename: str = Field(default="output.mp4")

class VideoAnalysisResponse(BaseModel):
    video_filename: str
    total_scenes: int
    scenes: list[SceneCaption]

class Items(BaseModel):
    vector: list[float]
    video_id: str
    title: str
    start_time: float
    end_time: float
    text: str = ""