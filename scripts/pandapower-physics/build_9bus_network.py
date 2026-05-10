"""
WSCC 9-bus benchmark network.
Parameters from: Anderson & Fouad, Power Systems Control and Stability (1977).
Bus numbering matches the diagram in Playground.tsx: 1/2/3=gens, 4/7/9=step-up, 5/6/8=loads.
"""
import pandapower as pp


def build_network() -> pp.pandapowerNet:
    net = pp.create_empty_network(f_hz=60.0, sn_mva=100.0)

    # ── Buses ──────────────────────────────────────────────────────────────────
    # Generators (HV internal buses, 345 kV equivalent base)
    for bid, name in [(1, "Gen1"), (2, "Gen2"), (3, "Gen3")]:
        pp.create_bus(net, vn_kv=16.5 if bid == 1 else 18.0, name=name, index=bid)

    # Step-up transformer LV buses (connected to generators)
    for bid, name in [(4, "Bus4"), (7, "Bus7"), (9, "Bus9")]:
        pp.create_bus(net, vn_kv=230.0, name=name, index=bid)

    # Load buses
    for bid, name in [(5, "Bus5_Load"), (6, "Bus6_Load"), (8, "Bus8_Load")]:
        pp.create_bus(net, vn_kv=230.0, name=name, index=bid)

    # ── External grids (generators modeled as slack/PV) ────────────────────────
    # Bus 1 = slack (swing bus) — s_sc_max_mva required by pandapower shortcircuit module
    pp.create_ext_grid(
        net, bus=1, vm_pu=1.04, name="G1_slack",
        s_sc_max_mva=1000.0, s_sc_min_mva=800.0,
        rx_max=0.1, rx_min=0.1,
    )

    # Generators 2 and 3 (PV buses — vn_kv required by shortcircuit module)
    pp.create_gen(net, bus=2, p_mw=163.0, vm_pu=1.025, vn_kv=18.0,
                  xdss_pu=0.2, rdss_pu=0.005, cos_phi=0.9, name="G2")
    pp.create_gen(net, bus=3, p_mw=85.0,  vm_pu=1.025, vn_kv=18.0,
                  xdss_pu=0.2, rdss_pu=0.005, cos_phi=0.9, name="G3")

    # shortcircuit module needs rdss_ohm; derive from rdss_pu and rated impedance
    z_base_g2 = (18.0 ** 2) / 250.0    # Zbase = Vn^2 / Sn (MVA)
    z_base_g3 = (18.0 ** 2) / 250.0
    net.gen.at[0, "rdss_ohm"] = 0.005 * z_base_g2
    net.gen.at[1, "rdss_ohm"] = 0.005 * z_base_g3
    net.gen.at[0, "xdss_ohm"] = 0.2 * z_base_g2
    net.gen.at[1, "xdss_ohm"] = 0.2 * z_base_g3

    # ── Step-up transformers ───────────────────────────────────────────────────
    # G1 → Bus4,  ratio ~16.5kV / 230kV,  leakage ~0.0576 pu
    pp.create_transformer_from_parameters(
        net, hv_bus=4, lv_bus=1, sn_mva=250.0,
        vn_hv_kv=230.0, vn_lv_kv=16.5,
        vk_percent=5.76, vkr_percent=0.0, pfe_kw=0.0, i0_percent=0.0,
        name="T1",
    )
    # G2 → Bus7
    pp.create_transformer_from_parameters(
        net, hv_bus=7, lv_bus=2, sn_mva=250.0,
        vn_hv_kv=230.0, vn_lv_kv=18.0,
        vk_percent=6.25, vkr_percent=0.0, pfe_kw=0.0, i0_percent=0.0,
        name="T2",
    )
    # G3 → Bus9
    pp.create_transformer_from_parameters(
        net, hv_bus=9, lv_bus=3, sn_mva=250.0,
        vn_hv_kv=230.0, vn_lv_kv=18.0,
        vk_percent=5.86, vkr_percent=0.0, pfe_kw=0.0, i0_percent=0.0,
        name="T3",
    )

    # ── Transmission lines (all 230 kV, lengths are per-unit derived) ─────────
    # Parameters from WSCC benchmark (r/x/b in pu on 100 MVA base → convert)
    # z_base = 230^2/100 = 529 Ω;  length_km=1 used as synthetic, actual R/X/B set directly
    def add_line(from_b, to_b, r_ohm, x_ohm, c_uf, name):
        pp.create_line_from_parameters(
            net, from_bus=from_b, to_bus=to_b,
            length_km=1.0,
            r_ohm_per_km=r_ohm, x_ohm_per_km=x_ohm,
            c_nf_per_km=c_uf * 1000,   # μF → nF
            max_i_ka=0.9,              # thermal limit (conservative)
            name=name,
        )

    # Values: r + jx in pu × 529 Ω, b/2 in pu / 529 → μF at 60 Hz
    # Line 4-5:  0.0100 + j0.0850,  b=0.0880
    add_line(4, 5,  r_ohm=5.29, x_ohm=44.97, c_uf=0.0880 / (2 * 3.14159 * 60 * 529) * 1e6, name="L4-5")
    # Line 4-6:  0.0170 + j0.0920,  b=0.0790
    add_line(4, 6,  r_ohm=8.99, x_ohm=48.67, c_uf=0.0790 / (2 * 3.14159 * 60 * 529) * 1e6, name="L4-6")
    # Line 5-7:  0.0320 + j0.1610,  b=0.1530
    add_line(5, 7,  r_ohm=16.93, x_ohm=85.17, c_uf=0.1530 / (2 * 3.14159 * 60 * 529) * 1e6, name="L5-7")
    # Line 6-9:  0.0390 + j0.1700,  b=0.1790
    add_line(6, 9,  r_ohm=20.63, x_ohm=89.93, c_uf=0.1790 / (2 * 3.14159 * 60 * 529) * 1e6, name="L6-9")
    # Line 7-8:  0.0085 + j0.0720,  b=0.0745
    add_line(7, 8,  r_ohm=4.50, x_ohm=38.09, c_uf=0.0745 / (2 * 3.14159 * 60 * 529) * 1e6, name="L7-8")
    # Line 8-9:  0.0119 + j0.1008,  b=0.1045
    add_line(8, 9,  r_ohm=6.30, x_ohm=53.32, c_uf=0.1045 / (2 * 3.14159 * 60 * 529) * 1e6, name="L8-9")

    # ── Loads ──────────────────────────────────────────────────────────────────
    pp.create_load(net, bus=5, p_mw=125.0, q_mvar=50.0,  name="Load_5")
    pp.create_load(net, bus=6, p_mw=90.0,  q_mvar=30.0,  name="Load_6")
    pp.create_load(net, bus=8, p_mw=100.0, q_mvar=35.0,  name="Load_8")

    return net


if __name__ == "__main__":
    net = build_network()
    pp.runpp(net, algorithm="nr", numba=False)
    print("\n── Bus Voltages ──────────────────────────────")
    print(net.res_bus[["vm_pu", "va_degree"]].to_string())
    print("\n── Line Loading ──────────────────────────────")
    print(net.res_line[["p_from_mw", "i_from_ka", "loading_percent"]].to_string())
    print("\n── Generator Output ──────────────────────────")
    print(net.res_gen[["p_mw", "q_mvar"]].to_string())
