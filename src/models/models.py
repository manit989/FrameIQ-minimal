from pydantic import BaseModel, Field


class SceneCaption(BaseModel):
    start_time: float = Field(description="Scene start time in seconds")
    end_time: float = Field(description="Scene end time in seconds")
    visual_description: str = Field(description="Describe the environment and actions")
    detected_objects: list[str] = Field(description="List of prominent objects")
    recognized_figures: list[str] = Field(description="Named famous people, artists, characters, or public figures identified")
    activity_type: str = Field(description="Classify the activity, e.g., 'freestyle rap', 'cooking tutorial', 'interview', 'live concert'")
    setting: str = Field(description="Where this takes place, e.g., 'recording studio', 'street corner', 'stage', 'kitchen'")
    visual_cues: list[str] = Field(description="Observable indicators revealing context, e.g., 'handheld microphone', 'sound panels', 'graffiti wall'")
    audio_genre_and_mood: str = Field(description="E.g., 'Indie rap, boom-bap beat, aggressive tone'")
    semantic_intent: str = Field(description="Summarize the meaning of what is happening or being said")
    search_tags: list[str] = Field(description="5 high-level abstract keywords a user might search")
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