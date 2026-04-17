from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Floorplan(Base):
    __tablename__ = "floorplans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    width = Column(Integer, nullable=False, default=1200)
    height = Column(Integer, nullable=False, default=800)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    serverroom_links = relationship("ServerRoomFloorplan", back_populates="floorplan", cascade="all, delete-orphan")
    racks = relationship("Rack", back_populates="floorplan", cascade="all, delete-orphan")


class Rack(Base):
    __tablename__ = "racks"

    id = Column(Integer, primary_key=True, index=True)
    floorplan_id = Column(Integer, ForeignKey("floorplans.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False, default=80)
    height = Column(Integer, nullable=False, default=220)
    units = Column(Integer, nullable=False, default=42)
    orientation = Column(String(16), nullable=False, default="front")

    floorplan = relationship("Floorplan", back_populates="racks")
    devices = relationship("Device", back_populates="rack", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("racks.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(128), nullable=False)
    device_type = Column(String(64), nullable=False)
    u_position = Column(Integer, nullable=False)
    u_height = Column(Integer, nullable=False, default=1)
    mount_side = Column(String(16), nullable=False, default="front")
    serial_number = Column(String(128), nullable=True)
    management_ip = Column(String(64), nullable=True)
    model = Column(String(128), nullable=True)
    vendor = Column(String(128), nullable=True)
    properties = Column(JSON, nullable=False, default=dict)

    rack = relationship("Rack", back_populates="devices")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(128), nullable=False)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(64), nullable=False)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    note = Column(Text, nullable=True)


class LocalUser(Base):
    __tablename__ = "local_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(128), nullable=False, unique=True, index=True)
    password_hash = Column(String(512), nullable=False)
    role = Column(String(32), nullable=False, default="user")
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ServerRoom(Base):
    __tablename__ = "serverrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    floorplan_links = relationship(
        "ServerRoomFloorplan",
        back_populates="serverroom",
        cascade="all, delete-orphan",
    )


class ServerRoomFloorplan(Base):
    __tablename__ = "serverroom_floorplans"

    id = Column(Integer, primary_key=True, index=True)
    serverroom_id = Column(Integer, ForeignKey("serverrooms.id", ondelete="CASCADE"), nullable=False)
    floorplan_id = Column(Integer, ForeignKey("floorplans.id", ondelete="CASCADE"), nullable=False, unique=True)

    serverroom = relationship("ServerRoom", back_populates="floorplan_links")
    floorplan = relationship("Floorplan", back_populates="serverroom_links")


class DeviceModel(Base):
    __tablename__ = "device_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    vendor = Column(String(128), nullable=False)
    model_code = Column(String(128), nullable=False)
    device_type = Column(String(64), nullable=False, default="server")
    u_height = Column(Integer, nullable=False, default=1)
    image_url = Column(String(512), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryDevice(Base):
    __tablename__ = "inventory_devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    model = Column(String(128), nullable=True)
    serial_number = Column(String(128), nullable=False, unique=True, index=True)
    vendor = Column(String(128), nullable=True)
    device_type = Column(String(64), nullable=False, default="server")
    u_height = Column(Integer, nullable=False, default=1)
    mount_side = Column(String(16), nullable=False, default="front")
    management_ip = Column(String(64), nullable=True)
    archived = Column(Integer, nullable=False, default=0)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    properties = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
