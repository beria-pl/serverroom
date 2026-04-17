from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str
    auth_source: str


class LoginRequest(BaseModel):
    username: str
    password: str


class DeviceBase(BaseModel):
    name: str
    device_type: str
    u_position: int = Field(ge=1)
    u_height: int = Field(ge=1, default=1)
    mount_side: str = Field(default="front", pattern="^(front|back)$")
    serial_number: str | None = None
    management_ip: str | None = None
    model: str | None = None
    vendor: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class DeviceCreate(DeviceBase):
    rack_id: int
    device_model_id: int | None = None


class DeviceUpdate(DeviceBase):
    pass


class DeviceOut(DeviceBase):
    id: int
    rack_id: int

    class Config:
        from_attributes = True


class RackBase(BaseModel):
    name: str
    x: int
    y: int
    width: int = Field(default=52, ge=16)
    height: int = Field(default=34, ge=16)
    units: int = Field(default=42, ge=1)
    orientation: str = "front"


class RackCreate(RackBase):
    floorplan_id: int


class RackUpdate(RackBase):
    pass


class RackOut(RackBase):
    id: int
    floorplan_id: int
    devices: list[DeviceOut] = []

    class Config:
        from_attributes = True


class FloorplanBase(BaseModel):
    name: str
    width: int = Field(default=1000, ge=200)
    height: int = Field(default=640, ge=200)


class FloorplanCreate(FloorplanBase):
    serverroom_id: int


class FloorplanUpdate(FloorplanBase):
    pass


class FloorplanOut(FloorplanBase):
    id: int
    serverroom_id: int | None = None
    racks: list[RackOut] = []

    class Config:
        from_attributes = True


class AuditOut(BaseModel):
    id: int
    actor: str
    action: str
    entity_type: str
    entity_id: str
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    created_at: datetime
    note: str | None

    class Config:
        from_attributes = True


class LocalUserCreate(BaseModel):
    username: str
    password: str = Field(min_length=8)
    role: str = "user"


class LocalUserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: int
    created_at: datetime

    class Config:
        from_attributes = True


class ServerRoomBase(BaseModel):
    name: str
    description: str | None = None


class ServerRoomCreate(ServerRoomBase):
    pass


class ServerRoomOut(ServerRoomBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceModelBase(BaseModel):
    name: str
    vendor: str
    model_code: str
    device_type: str = "server"
    u_height: int = Field(ge=1, default=1)
    image_url: str


class DeviceModelCreate(DeviceModelBase):
    pass


class DeviceModelOut(DeviceModelBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryDeviceOut(BaseModel):
    id: int
    name: str
    model: str | None = None
    serial_number: str
    vendor: str | None = None
    device_type: str
    u_height: int
    mount_side: str = "front"
    management_ip: str | None = None
    archived: int
    archived_at: datetime | None = None
    properties: dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True
