"""Customer cohort and daily-acquisition generation."""
from datetime import datetime

import numpy as np

from .config import get_date_config, get_event_config, get_growth_config, get_personas
from .event import get_event_multiplier
from .growth import get_growth_multiplier, get_simulation_year
from .utils import apply_noise, get_day_of_week, get_month_name, weighted_choice

_personas = get_personas()
_date_config = get_date_config()
_growth = get_growth_config()


def generate_user_id(date, user_counter):
    return f"{date.replace('-', '')}-{user_counter:08d}"


def generate_base_user_table():
    rows, persona_list = [], []
    for persona_name, persona in _personas.items():
        persona_list.extend([persona_name] * int(persona.get("base_user", 0)))
    # The shuffle lets the configured cohort mix without changing the persona counts.
    import random
    random.shuffle(persona_list)
    for index, persona_name in enumerate(persona_list, start=1):
        persona = _personas[persona_name]
        rows.append({
            "persona": persona_name,
            "user_id": generate_user_id(_date_config["start_date"], index),
            "city": weighted_choice(persona["city"]),
            "gender": weighted_choice(persona["gender"]),
            "acquisition_channel": weighted_choice(persona["acquisition_channel"]),
            "registered_date": _date_config["start_date"],
            "last_active_date": _date_config["start_date"],
        })
    return rows


def get_daily_new_user_rate(persona_name, date):
    """Expected new-user arrivals; sampled as Poisson rather than capped retries."""
    persona = _personas[persona_name]
    weekend = get_day_of_week(date) in {"saturday", "sunday"}
    chance_key = "daily_new_user_chance_weekend" if weekend else "daily_new_user_chance"
    # ``daily_retry`` is retained as the legacy baseline number of acquisition opportunities.
    rate = float(persona.get("daily_retry", 1)) * float(persona.get(chance_key, 0.0))
    rate *= float(persona.get("monthly_new_user_multiplier", {}).get(get_month_name(date), 1.0))
    rate *= apply_noise(rate, persona.get("daily_new_user_noise"))
    rate *= apply_noise(rate, persona.get("monthly_new_user_noise"))
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    start = datetime.strptime(_date_config["start_date"], "%Y-%m-%d")
    rate *= get_growth_multiplier(date=date_obj, simulation_start=start, growth_cfg=_growth,
                                  persona_name=persona_name, metric="new_user")
    rate *= get_event_multiplier(get_simulation_year(date_obj, start), date_obj.month,
                                 metric="new_user", persona=persona_name)
    return max(0.0, rate)


def roll_new_user_chance(persona_name, date):
    """Compatibility name: returns a Poisson number of daily arrivals."""
    return int(np.random.poisson(get_daily_new_user_rate(persona_name, date)))


def generate_new_users(num_users, persona_name, date, current_user_count):
    persona = _personas[persona_name]
    return [{
        "persona": persona_name,
        "user_id": generate_user_id(date, current_user_count + i + 1),
        "city": weighted_choice(persona["city"]),
        "gender": weighted_choice(persona["gender"]),
        "acquisition_channel": weighted_choice(persona["acquisition_channel"]),
    } for i in range(num_users)]
