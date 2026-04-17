from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLog


def write_audit(
    db: Session,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
    note: str | None = None,
) -> None:
    event = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        note=note,
    )
    db.add(event)
