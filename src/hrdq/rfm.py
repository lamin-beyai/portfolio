"""Customer segmentation for the win-back challenge: RFM features and K-means.

The customers are fictional. Four behaviour groups are planted, then K-means
has to rediscover them from recency, frequency and spend alone.
"""
from __future__ import annotations

import math
import random
from collections import Counter

SEED = 19980622
GROUPS = {  # size, mean days since last order, mean orders, mean order value
    "Champions": (260, 18, 16, 72),
    "Regulars": (520, 70, 7, 46),
    "Lapsed big spenders": (240, 300, 9, 95),
    "One-time buyers": (480, 330, 1.3, 31),
}
# Extra buyers a campaign creates: people who would not have bought anyway.
# These are assumptions for the exercise. Champions buy regardless, so uplift is low.
UPLIFT = {"Champions": 0.015, "Regulars": 0.05, "Lapsed big spenders": 0.11, "One-time buyers": 0.012}


def customers() -> list[dict]:
    rng = random.Random(SEED)
    rows = []
    for name, (size, recency, orders, value) in GROUPS.items():
        for _ in range(size):
            n = max(1, round(rng.lognormvariate(math.log(orders), 0.3)))
            rows.append({
                "group": name,
                "recency": max(1, round(rng.lognormvariate(math.log(recency), 0.28))),
                "frequency": n,
                "monetary": round(n * rng.lognormvariate(math.log(value), 0.25), 2),
            })
    rng.shuffle(rows)
    return rows


def _features(rows) -> list[list[float]]:
    raw = [[math.log(r["recency"]), math.log(r["frequency"]), math.log(r["monetary"])] for r in rows]
    scaled = []
    columns = list(zip(*raw))
    stats = [(sum(c) / len(c), math.sqrt(sum((x - sum(c) / len(c)) ** 2 for x in c) / len(c))) for c in columns]
    for point in raw:
        scaled.append([(x - m) / s for x, (m, s) in zip(point, stats)])
    return scaled


def _distance(a, b) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b))


def kmeans(points, k=4, seed=SEED, restarts=8):
    """K-means++ with restarts, keeping the tightest result."""
    best = None
    for attempt in range(restarts):
        rng = random.Random(seed + attempt)
        centres = [rng.choice(points)]
        while len(centres) < k:
            weights = [min(_distance(p, c) for c in centres) for p in points]
            centres.append(rng.choices(points, weights)[0])
        labels = None
        for _ in range(100):
            new = [min(range(k), key=lambda i: _distance(p, centres[i])) for p in points]
            if new == labels:
                break
            labels = new
            for i in range(k):
                members = [p for p, l in zip(points, labels) if l == i]
                if members:
                    centres[i] = [sum(c) / len(members) for c in zip(*members)]
        inertia = sum(_distance(p, centres[l]) for p, l in zip(points, labels))
        if best is None or inertia < best[0]:
            best = (inertia, labels)
    return best[1]


def _name_clusters(rows, labels) -> dict[int, str]:
    """Name each cluster from its average behaviour, not from the planted answer."""
    stats = {}
    for label in set(labels):
        members = [r for r, l in zip(rows, labels) if l == label]
        stats[label] = {k: sum(m[k] for m in members) / len(members) for k in ("recency", "frequency", "monetary")}
    remaining = set(stats)
    one_time = min(remaining, key=lambda l: stats[l]["monetary"]); remaining.remove(one_time)
    champions = min(remaining, key=lambda l: stats[l]["recency"]); remaining.remove(champions)
    lapsed = max(remaining, key=lambda l: stats[l]["recency"]); remaining.remove(lapsed)
    return {one_time: "One-time buyers", champions: "Champions", lapsed: "Lapsed big spenders",
            remaining.pop(): "Regulars"}


def segments() -> dict:
    rows = customers()
    labels = kmeans(_features(rows))
    names = _name_clusters(rows, labels)
    assigned = [names[l] for l in labels]
    agreement = sum(a == r["group"] for a, r in zip(assigned, rows)) / len(rows)
    result = []
    for name, size in Counter(assigned).most_common():
        members = [r for r, a in zip(rows, assigned) if a == name]
        spend = sum(m["monetary"] for m in members)
        orders = sum(m["frequency"] for m in members)
        result.append({
            "name": name, "customers": size, "uplift": UPLIFT[name],
            "recency": round(sum(m["recency"] for m in members) / size),
            "orders": round(orders / size, 1), "spend": round(spend / size),
            "orderValue": round(spend / orders, 2),
        })
    return {"segments": result, "customers": len(rows), "agreement": round(100 * agreement, 1)}
