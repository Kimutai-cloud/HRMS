class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ValidationErrorResponse(BaseModel):
    success: bool = False
    message: str = "Validation error"
    error_code: str = "VALIDATION_ERROR"
    details: List[Dict[str, Any]]

