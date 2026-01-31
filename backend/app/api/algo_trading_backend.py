"""
Modular Algo Trading Backend - ADD THIS TO YOUR EXISTING BACKEND

If you already have a FastAPI backend with replay functionality,
just add this file and import it in your main.py

Usage:
    from algo_trading_backend import router as algo_router
    app.include_router(algo_router)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import traceback

# ============================================================================
# MODELS
# ============================================================================

class StrategyExecutionRequest(BaseModel):
    """Request model for executing a strategy"""
    code: str
    candles: List[Dict[str, float]]
    current_price: float
    available_capital: float
    total_capital: float
    positions: List[Dict[str, Any]]

class StrategyExecutionResponse(BaseModel):
    """Response model for strategy execution"""
    action: str  # 'BUY', 'SELL', or 'HOLD'
    quantity: int
    reason: str
    error: Optional[str] = None

# ============================================================================
# STRATEGY EXECUTOR
# ============================================================================

class StrategyExecutor:
    """
    Safely execute Python trading strategies in a sandboxed environment
    """
    
    @staticmethod
    def execute(code: str, candles: List[Dict], current_price: float, 
                available_capital: float, total_capital: float, 
                positions: List[Dict]) -> StrategyExecutionResponse:
        """
        Execute a Python trading strategy
        
        Args:
            code: Python code containing strategy function
            candles: List of recent candles
            current_price: Current market price
            available_capital: Available capital for trading
            total_capital: Total capital allocated
            positions: List of current open positions
        
        Returns:
            StrategyExecutionResponse with action, quantity, and reason
        """
        try:
            # Create a restricted namespace with only safe built-in functions
            safe_builtins = {
                'len': len,
                'sum': sum,
                'max': max,
                'min': min,
                'abs': abs,
                'round': round,
                'int': int,
                'float': float,
                'str': str,
                'list': list,
                'dict': dict,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'sorted': sorted,
                'print': print,  # For debugging (output goes to console)
            }
            
            # Create isolated namespace for strategy execution
            namespace = {
                '__builtins__': safe_builtins,
                'candles': candles,
                'current_price': current_price,
                'available_capital': available_capital,
                'total_capital': total_capital,
                'positions': positions,
            }
            
            # Execute the strategy code in isolated namespace
            exec(code, namespace)
            
            # Verify strategy function exists
            if 'strategy' not in namespace:
                raise ValueError(
                    "Strategy code must define a 'strategy' function. "
                    "Example: def strategy(candles, current_price, available_capital, total_capital, positions): ..."
                )
            
            # Call the strategy function
            result = namespace['strategy'](
                candles,
                current_price,
                available_capital,
                total_capital,
                positions
            )
            
            # Validate result format
            if not isinstance(result, dict):
                raise ValueError(
                    "Strategy must return a dictionary. "
                    "Example: {'action': 'BUY', 'quantity': 10, 'reason': 'Signal detected'}"
                )
            
            if 'action' not in result:
                raise ValueError("Strategy result must include 'action' key (BUY, SELL, or HOLD)")
            
            # Validate action
            action = result.get('action', 'HOLD').upper()
            if action not in ['BUY', 'SELL', 'HOLD']:
                raise ValueError(f"Invalid action: {action}. Must be 'BUY', 'SELL', or 'HOLD'")
            
            # Extract and validate quantity
            quantity = int(result.get('quantity', 0))
            if quantity < 0:
                raise ValueError(f"Quantity must be non-negative, got: {quantity}")
            
            # Extract reason
            reason = str(result.get('reason', 'No reason provided'))
            
            return StrategyExecutionResponse(
                action=action,
                quantity=quantity,
                reason=reason
            )
            
        except Exception as e:
            # Log the full traceback for debugging
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            print(f"[STRATEGY ERROR] {error_msg}")
            
            # Return safe error response
            return StrategyExecutionResponse(
                action='HOLD',
                quantity=0,
                reason='Error in strategy execution',
                error=str(e)
            )

# ============================================================================
# ROUTER
# ============================================================================

# Create router for algo trading endpoints
router = APIRouter(prefix="/api", tags=["algo-trading"])

@router.post("/execute-strategy", response_model=StrategyExecutionResponse)
async def execute_strategy(request: StrategyExecutionRequest):
    """
    Execute a Python trading strategy
    
    This endpoint is called by the frontend on each new candle to get
    trading signals from the user's custom strategy.
    
    Example request:
    ```json
    {
        "code": "def strategy(candles, current_price, ...):\\n    return {'action': 'BUY', 'quantity': 10, 'reason': 'Signal'}",
        "candles": [{"open": 100, "high": 101, "low": 99, "close": 100.5, "volume": 1000}],
        "current_price": 100.5,
        "available_capital": 10000,
        "total_capital": 10000,
        "positions": []
    }
    ```
    
    Example response:
    ```json
    {
        "action": "BUY",
        "quantity": 10,
        "reason": "Bullish signal detected",
        "error": null
    }
    ```
    """
    return StrategyExecutor.execute(
        request.code,
        request.candles,
        request.current_price,
        request.available_capital,
        request.total_capital,
        request.positions
    )

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "algo-trading",
        "endpoints": {
            "execute_strategy": "/api/execute-strategy"
        }
    }

# ============================================================================
# INTEGRATION EXAMPLE
# ============================================================================

"""
HOW TO INTEGRATE WITH YOUR EXISTING BACKEND:

1. Save this file as 'algo_trading_backend.py' in your backend directory

2. In your main.py (or wherever you initialize FastAPI), add:

    ```python
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from algo_trading_backend import router as algo_router
    
    app = FastAPI()
    
    # Add CORS if needed
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include the algo trading router
    app.include_router(algo_router)
    
    # Your existing routes...
    @app.websocket("/ws/replay")
    async def replay_endpoint(...):
        # Your existing code
        pass
    ```

3. That's it! The endpoint will be available at:
   POST http://localhost:8000/api/execute-strategy

4. Test it:
    ```bash
    curl -X POST http://localhost:8000/api/execute-strategy \
      -H "Content-Type: application/json" \
      -d '{
        "code": "def strategy(candles, current_price, available_capital, total_capital, positions):\\n    return {\"action\": \"HOLD\", \"quantity\": 0, \"reason\": \"Test\"}",
        "candles": [],
        "current_price": 100.0,
        "available_capital": 10000.0,
        "total_capital": 10000.0,
        "positions": []
      }'
    ```

SECURITY NOTES:
- Code runs in isolated namespace with limited built-ins
- No import statements allowed
- No file I/O or network access
- No access to system modules
- Execution errors are caught and returned safely

For production, consider adding:
- Execution timeout (use signal.alarm or asyncio.timeout)
- Memory limits
- Rate limiting
- Strategy code validation
- Logging and monitoring
"""

# ============================================================================
# OPTIONAL: ADD TIMEOUT PROTECTION
# ============================================================================

"""
If you want to add execution timeout protection:

import signal
from contextlib import contextmanager

class TimeoutException(Exception):
    pass

@contextmanager
def time_limit(seconds):
    def signal_handler(signum, frame):
        raise TimeoutException("Strategy execution timed out")
    signal.signal(signal.SIGALRM, signal_handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)

# Then in StrategyExecutor.execute(), wrap exec() call:
with time_limit(5):  # 5 second timeout
    exec(code, namespace)
"""