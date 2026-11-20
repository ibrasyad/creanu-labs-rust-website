"""Campaign and event multipliers."""
from .config import get_event_config, get_personas

_event = get_event_config()


def is_event_active(event, simulation_year, current_month, current_date=None):
    """Events can be scheduled by simulation year/month (end_month=None means permanent) or explicit ISO dates."""
    start_date = event.get("start_date")
    end_date = event.get("end_date")
    if start_date or end_date:
        if current_date is None:
            return False
        if start_date and current_date < str(start_date):
            return False
        if end_date and current_date > str(end_date):
            return False
        return True

    event_year = int(event.get("year", 1))
    start_month = int(event.get("start_month") or 1)
    end_month = event.get("end_month")
    if end_month is None:
        return simulation_year > event_year or (simulation_year == event_year and current_month >= start_month)
    return simulation_year == event_year and start_month <= current_month <= int(end_month)


def get_metric_multiplier(metric_cfg, funnel_step=None):
    if metric_cfg is None:
        return 1.0
    if isinstance(metric_cfg, (int, float)):
        return float(metric_cfg)
    if isinstance(metric_cfg, dict) and funnel_step:
        return float(metric_cfg.get(funnel_step, 1.0))
    return 1.0


def get_event_multiplier(simulation_year, current_month, metric, persona=None, funnel_step=None, current_date=None):
    """Return cumulative active-event effects with persona > profile > overall precedence."""
    profile = get_personas().get(persona, {}).get("profile") if persona else None
    multiplier = 1.0
    for event in _event.values():
        if not is_event_active(event, simulation_year, current_month, current_date=current_date):
            continue
        metric_cfg = event.get("personas", {}).get(persona, {}).get(metric)
        if metric_cfg is None and profile:
            metric_cfg = event.get("profiles", {}).get(profile, {}).get(metric)
        if metric_cfg is None:
            metric_cfg = event.get("overall", {}).get(metric)
        multiplier *= get_metric_multiplier(metric_cfg, funnel_step)
    return multiplier
