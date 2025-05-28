from typing import List

class SettingsManager:
    """Singleton for dynamic SMT analysis settings updated via API"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SettingsManager, cls).__new__(cls)
            cls._init_defaults(cls._instance)
        return cls._instance

    @classmethod
    def _init_defaults(cls, inst):
        # Divergence detector
        inst.min_divergence_threshold: float = 0.5
        inst.lookback_period: int = 20
        # MSS analyzer
        inst.swing_threshold: float = 0.5
        inst.lookback_swings: int = 5
        # Order block detector
        inst.min_block_size: float = 0.3
        inst.volume_threshold: float = 1.5
        # FVG detector
        inst.min_fvg_gap_size: float = 0.2
        # Quarterly analyzer
        inst.quarterly_months: List[int] = [1, 4, 7, 10]
        inst.monthly_bias_days: List[int] = [1, 2, 3]

    def to_dict(self) -> dict:
        return {
            "min_divergence_threshold": self.min_divergence_threshold,
            "lookback_period": self.lookback_period,
            "swing_threshold": self.swing_threshold,
            "lookback_swings": self.lookback_swings,
            "min_block_size": self.min_block_size,
            "volume_threshold": self.volume_threshold,
            "min_fvg_gap_size": self.min_fvg_gap_size,
            "quarterly_months": self.quarterly_months,
            "monthly_bias_days": self.monthly_bias_days,
        }

    def update(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)