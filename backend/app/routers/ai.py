from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import AccessLog, User, get_db
from app.dependencies import get_current_user
from app.schemas import AskRequest, AskResponse
from app.services.ai_service import generate_answer, search_chunks
from app.services.permission_service import visible_document_ids

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    allowed_ids = visible_document_ids(db, user)
    results = search_chunks(db, payload.question, allowed_ids)
    answer = generate_answer(payload.question, results)

    sources = sorted({filename for _, filename, _ in results})

    db.add(AccessLog(user_id=user.id, action="ASK_AI", detail=payload.question[:200]))
    db.commit()

    return AskResponse(answer=answer, sources=sources)
