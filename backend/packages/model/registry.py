from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class ModelArtifact:
    name: str
    created_at: datetime
    path: str


class ModelRegistry:
    def __init__(self) -> None:
        self._artifacts: dict[str, ModelArtifact] = {}

    def register(self, name: str, path: str) -> ModelArtifact:
        artifact = ModelArtifact(name=name, created_at=datetime.now(timezone.utc), path=path)
        self._artifacts[name] = artifact
        return artifact

    def latest(self) -> ModelArtifact | None:
        if not self._artifacts:
            return None
        return max(self._artifacts.values(), key=lambda artifact: artifact.created_at)
