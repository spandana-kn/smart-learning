from fastapi import HTTPException, status

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

not_found = lambda detail="Not found": HTTPException(status_code=404, detail=detail)
bad_request = lambda detail="Bad request": HTTPException(status_code=400, detail=detail)
forbidden = HTTPException(status_code=403, detail="Access forbidden")
