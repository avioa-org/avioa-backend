"""
Genera el JSON que se le envía a POST /admin/vacations/bulk-migrate-historical

Uso:
    python generar_payload_migracion.py \
        --export-portal export_portal_con_userid.json \
        --reconciliacion reconciliacion_vacaciones.csv \
        --fecha-corte 2026-09-09 \
        --out bulk-migrate-payload.json
        # --leader-id es OPCIONAL: solo se usa como fallback para quienes
        # tengan leaderId=null en el export del portal.

Entradas:
- export_portal_con_userid.json: el export del portal. Ahora incluye
  "leaderId" dentro de cada "user" (puede ser null para líderes de
  arriba o usuarios sin jefe asignado).
- reconciliacion_vacaciones.csv: con NUEVO_taken, NUEVO_adjustment,
  y A_MIGRAR_como_historico.

Salida:
- bulk-migrate-payload.json: listo para el body del endpoint,
  con dryRun=true por defecto.

Sobre leaderId:
- Se toma del JSON, por persona.
- Si el usuario tiene leaderId=null, se usa --leader-id (si se pasó).
- Si no hay ninguno de los dos, la persona se excluye y se lista
  al final en "SIN LEADER" para que la resuelvas a mano.

IMPORTANTE - días ya pedidos desde el portal:
Usamos la columna "A_MIGRAR_como_historico" del CSV (no "NUEVO_taken"
directamente). Esa columna ya resta los días que el portal tenga
registrados como LeaveRequest reales (columna ACTUAL_taken), para no
duplicarlos.

Personas marcadas con "conflicto_negativo" se excluyen automáticamente
y quedan listadas al final.

Nota sobre medios días: businessDays es Int en Prisma, así que los
decimales se redondean al entero más cercano y quedan listados aparte.
"""

import argparse
import json
import re
import unicodedata
from datetime import datetime, timedelta


def norm(s: str) -> str:
    s = s.upper()
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^A-Z ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--export-portal', required=True)
    ap.add_argument('--reconciliacion', required=True)
    ap.add_argument('--leader-id', default=None,
                     help='UUID de fallback para usuarios con leaderId=null en el export. '
                          'Si un usuario no tiene leaderId ni este fallback, se excluye.')
    ap.add_argument('--fecha-corte', default=None,
                     help='YYYY-MM-DD usado como startDate/endDate placeholder. Por defecto: ayer.')
    ap.add_argument('--out', default='bulk-migrate-payload.json')
    args = ap.parse_args()

    import csv

    with open(args.export_portal, encoding='utf-8') as f:
        portal = json.load(f)

    # Lookups por nombre normalizado
    name_to_userid = {norm(p['user']['name']): p['user']['userId'] for p in portal}
    name_to_leader = {norm(p['user']['name']): p['user'].get('leaderId') for p in portal}

    fecha_corte = args.fecha_corte or (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')

    entries = []
    medios_dias = []
    sin_userid = []
    sin_leader = []
    conflictos_negativos = []

    with open(args.reconciliacion, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            nombre = row['nombre']
            nombre_norm = norm(nombre)

            userid = name_to_userid.get(nombre_norm)
            if not userid:
                sin_userid.append(nombre)
                continue

            if row.get('conflicto_negativo'):
                conflictos_negativos.append(
                    (nombre, row.get('ACTUAL_taken'), row.get('NUEVO_taken'))
                )
                continue

            # Líder: primero del JSON, luego fallback global
            leader_id = name_to_leader.get(nombre_norm) or args.leader_id
            if not leader_id:
                sin_leader.append(nombre)
                continue

            taken_raw = float(row['A_MIGRAR_como_historico'] or 0)
            taken_rounded = int(round(taken_raw))
            if abs(taken_raw - taken_rounded) > 1e-9:
                medios_dias.append((nombre, taken_raw, taken_rounded))

            entries.append({
                "userId": userid,
                "leaderId": leader_id,
                "businessDays": taken_rounded,
                "startDate": fecha_corte,
                "endDate": fecha_corte,
                "reason": f"Saldo historico validado por RRHH al {fecha_corte}",
                "newAdjustment": 0,
            })

    payload = {"dryRun": True, "entries": entries}

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"OK: {len(entries)} entradas escritas en {args.out} (dryRun=true)")

    if sin_userid:
        print(f"\nADVERTENCIA: {len(sin_userid)} personas del CSV no se encontraron en el export (revisa nombres):")
        for n in sin_userid:
            print(f"  - {n}")

    if sin_leader:
        print(f"\nSIN LEADER ({len(sin_leader)}): no tienen leaderId en el export ni se pasó --leader-id. Excluidas:")
        for n in sin_leader:
            print(f"  - {n}")

    if medios_dias:
        print(f"\nADVERTENCIA: {len(medios_dias)} personas con días no enteros, se redondearon:")
        for n, raw, rounded in medios_dias:
            print(f"  - {n}: {raw} -> {rounded}")

    if conflictos_negativos:
        print(f"\nEXCLUIDAS ({len(conflictos_negativos)}): portal ya tiene MÁS días tomados que el validado:")
        for n, actual, nuevo in conflictos_negativos:
            print(f"  - {n}: portal ya tiene {actual} tomados, dato validado dice {nuevo}")


if __name__ == '__main__':
    main()