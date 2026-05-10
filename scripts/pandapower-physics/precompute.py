"""
Precompute WSCC 9-bus fault physics for all (line, fault_type) combinations.
Uses Z-bus (bus impedance matrix) method — textbook fault analysis.
Outputs: ../../chronogrid-demo/public/physics.json
"""
import copy
import json
import sys
from pathlib import Path

import numpy as np
import pandapower as pp

from build_9bus_network import build_network

OUT_PATH = Path(__file__).parent.parent.parent / "chronogrid-demo" / "public" / "physics.json"

FAULT_CLASSES = ["AG", "BG", "CG", "AB", "AC", "BC", "ABG", "ACG", "BCG", "ABCG", "NF"]
LINE_MAP = {
    "L4-5": (4, 5),
    "L4-6": (4, 6),
    "L5-7": (5, 7),
    "L6-9": (6, 9),
    "L7-8": (7, 8),
    "L8-9": (8, 9),
}
RATED_I_KA = 0.9
OVERCURRENT_THR = 1.5

# Fault current multiplier relative to 3-phase fault (per IEC 60909 approximate)
FAULT_MULTIPLIER = {
    "ABCG": 1.00,   # three-phase — maximum
    "ABG":  0.87,   # two-phase to ground
    "ACG":  0.87,
    "BCG":  0.87,
    "AB":   0.87,   # phase-to-phase (line-to-line)
    "AC":   0.87,
    "BC":   0.87,
    "AG":   0.65,   # single-phase to ground (typical range 0.5–0.9)
    "BG":   0.65,
    "CG":   0.65,
    "NF":   0.00,
}


def run_pf(net):
    """Run power flow and return bus voltages (pu) and line currents (kA)."""
    pp.runpp(net, algorithm="nr", numba=False, verbose=False)
    v = {str(i): round(float(net.res_bus.loc[i, "vm_pu"]), 4) for i in net.bus.index}
    i_line = {}
    for idx, row in net.line.iterrows():
        i_line[row["name"]] = round(float(net.res_line.loc[idx, "i_from_ka"]), 4)
    return v, i_line


S_BASE  = 100.0   # MVA
V_BASE  = 230.0   # kV (HV transmission)
Z_BASE  = V_BASE ** 2 / S_BASE   # Ω = 529 Ω
I_BASE  = S_BASE / (np.sqrt(3) * V_BASE)   # kA ≈ 0.2507 kA


def build_ybus_pu(net) -> tuple[np.ndarray, dict[int, int]]:
    """
    Build Y-bus in per-unit on 100 MVA / 230 kV base.
    Returns Y_pu, bus_index mapping.
    """
    buses = sorted(net.bus.index.tolist())
    n = len(buses)
    idx = {b: i for i, b in enumerate(buses)}
    Y = np.zeros((n, n), dtype=complex)

    # Transmission lines
    for _, row in net.line.iterrows():
        fb, tb = int(row["from_bus"]), int(row["to_bus"])
        L = row["length_km"]
        r_pu = row["r_ohm_per_km"] * L / Z_BASE
        x_pu = row["x_ohm_per_km"] * L / Z_BASE
        b_pu = row["c_nf_per_km"] * L * 2 * np.pi * 60.0 * 1e-9 * Z_BASE  # B in pu
        z_pu = complex(r_pu, x_pu)
        y_pu = 1 / z_pu
        i, j = idx[fb], idx[tb]
        Y[i, i] += y_pu + complex(0, b_pu / 2)
        Y[j, j] += y_pu + complex(0, b_pu / 2)
        Y[i, j] -= y_pu
        Y[j, i] -= y_pu

    # Transformers — series impedance in pu on system base
    for _, row in net.trafo.iterrows():
        hv, lv = int(row["hv_bus"]), int(row["lv_bus"])
        vk  = row["vk_percent"] / 100.0
        vkr = row["vkr_percent"] / 100.0
        sn  = row["sn_mva"]
        z_pu_trafo = complex(vkr, np.sqrt(max(vk**2 - vkr**2, 0)))
        z_pu_sys   = z_pu_trafo * (S_BASE / sn)   # convert to system base
        y_pu = 1 / z_pu_sys
        i, j = idx[hv], idx[lv]
        Y[i, i] += y_pu
        Y[j, j] += y_pu
        Y[i, j] -= y_pu
        Y[j, i] -= y_pu

    # External grid — Thevenin equivalent from s_sc_max_mva
    for _, row in net.ext_grid.iterrows():
        b     = int(row["bus"])
        s_sc  = float(row.get("s_sc_max_mva", 1000.0))
        rx    = float(row.get("rx_max", 0.1))
        z_pu_abs = S_BASE / s_sc             # in pu on system base
        theta    = np.arctan(1.0 / rx)       # angle from r/x ratio
        z_pu     = z_pu_abs * complex(np.cos(theta), np.sin(theta))
        y_pu     = 1 / z_pu
        Y[idx[b], idx[b]] += y_pu

    return Y, idx


def compute_fault_physics(
    pre_v: dict, pre_i: dict,
    Z_pu: np.ndarray, idx: dict[int, int],
    fault_bus: int, fault_type: str,
    line_name: str, net,
) -> dict:
    """
    Z-bus fault analysis (all quantities in per-unit on 100 MVA / 230 kV base).
    Returns bus_voltages (pu), line_currents (kA), fault_current_ka, affected_lines.
    """
    f = idx[fault_bus]
    V_f_pu = float(pre_v[str(fault_bus)])
    Z_ff   = Z_pu[f, f]

    # 3-phase bolted fault current in pu
    I_f3ph_pu = V_f_pu / Z_ff if abs(Z_ff) > 0 else 0

    # Scale for specific fault type
    mult  = FAULT_MULTIPLIER[fault_type]
    I_f_pu = I_f3ph_pu * mult

    # Bus voltages during fault: V_i = V_i_pre - Z_if × I_f  (pu)
    bus_voltages = {}
    for b, i in idx.items():
        dv = float(abs(Z_pu[i, f] * I_f_pu))
        v  = float(pre_v[str(b)]) - dv
        bus_voltages[str(b)] = round(max(0.0, min(1.1, v)), 4)

    fault_i_ka = round(float(abs(I_f_pu) * I_BASE), 4)

    # Line currents: ΔV across line / line impedance (pu → kA)
    line_currents = {}
    for _, row in net.line.iterrows():
        lname = row["name"]
        if lname not in LINE_MAP:
            continue
        fb2, tb2 = int(row["from_bus"]), int(row["to_bus"])
        L   = row["length_km"]
        z_pu = complex(row["r_ohm_per_km"] * L, row["x_ohm_per_km"] * L) / Z_BASE
        V_from = bus_voltages.get(str(fb2), 1.0)
        V_to   = bus_voltages.get(str(tb2), 1.0)
        if abs(z_pu) > 0:
            i_pu = abs(V_from - V_to) / abs(z_pu)
        else:
            i_pu = 0.0
        # faulted line sees additional fault current
        if lname == line_name:
            i_pu += abs(I_f_pu) * 0.5
        line_currents[lname] = round(float(i_pu * I_BASE), 4)

    affected = [ln for ln, i_ka in line_currents.items() if i_ka > RATED_I_KA * OVERCURRENT_THR]
    return {
        "bus_voltages":     bus_voltages,
        "line_currents":    line_currents,
        "fault_current_ka": fault_i_ka,
        "affected_lines":   affected,
    }


def main():
    print("Building WSCC 9-bus network…")
    base_net = build_network()

    print("Running pre-fault power flow…")
    pre_v, pre_i = run_pf(copy.deepcopy(base_net))
    print(f"  Bus 5 = {pre_v['5']} pu  Bus 6 = {pre_v['6']} pu  Bus 8 = {pre_v['8']} pu")

    print("Building Y-bus (Z-bus = inv(Y-bus))…")
    Y_pu, idx = build_ybus_pu(base_net)
    Z_pu = np.linalg.inv(Y_pu)

    result = {
        "pre_fault": {"bus_voltages": pre_v, "line_currents": pre_i},
        "faults": {},
    }

    total = len(LINE_MAP) * len(FAULT_CLASSES)
    done = 0
    for line_name, (fb, tb) in LINE_MAP.items():
        result["faults"][line_name] = {}
        # Fault is modelled at the "from" bus (closer to generator for most lines)
        fault_bus = fb
        for fc in FAULT_CLASSES:
            if fc == "NF":
                result["faults"][line_name][fc] = {
                    "bus_voltages":     pre_v.copy(),
                    "line_currents":    pre_i.copy(),
                    "fault_current_ka": 0.0,
                    "affected_lines":   [],
                }
            else:
                scenario = compute_fault_physics(
                    pre_v, pre_i, Z_pu, idx, fault_bus, fc, line_name, base_net
                )
                result["faults"][line_name][fc] = scenario
                done += 1
                print(f"  [{done/total*100:5.1f}%] {line_name}/{fc} "
                      f"→ {scenario['fault_current_ka']:.2f} kA, "
                      f"Bus {fault_bus} V={scenario['bus_voltages'][str(fault_bus)]} pu, "
                      f"{len(scenario['affected_lines'])} overcurrent")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\n✓ Written to {OUT_PATH}  ({size_kb:.1f} KB)")

    # Sanity: 3ph fault should give highest current
    all_ok = True
    for line_name in LINE_MAP:
        i3ph = result["faults"][line_name]["ABCG"]["fault_current_ka"]
        i1ph = result["faults"][line_name]["AG"]["fault_current_ka"]
        ok = i3ph >= i1ph
        print(f"  {'✓' if ok else '⚠'} {line_name}: ABCG {i3ph:.2f} kA  AG {i1ph:.2f} kA")
        all_ok = all_ok and ok

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
