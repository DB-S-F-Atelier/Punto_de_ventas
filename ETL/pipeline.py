import os
import duckdb
import pandas as pd
from supabase import create_client

def run_pipeline():
    print("🚀 Iniciando ETL para S&F Atelier...")

    # 1. CONEXIÓN A SUPABASE (OLTP)
    supa_url = os.environ.get("SUPABASE_URL")
    supa_key = os.environ.get("SUPABASE_KEY")
    supabase = create_client(supa_url, supa_key)

    print("📥 Extrayendo datos de Supabase...")
    response = supabase.table("orders").select("*").execute()
    data = response.data

    if not data:
        print("⚠️ No hay datos para procesar. Saliendo.")
        return

    df_raw = pd.DataFrame(data)

    # 2. CONEXIÓN A MOTHERDUCK (OLAP)
    md_token = os.environ.get("MOTHERDUCK_TOKEN")
    print("🦆 Conectando a MotherDuck...")
    # Nos conectamos específicamente a la base de datos que creaste
    con = duckdb.connect(f"md:sf_atelier_dw?motherduck_token={md_token}")

    # ==========================================
    # ARQUITECTURA MEDALLÓN
    # ==========================================

    # 🥉 CAPA BRONZE (Datos Crudos)
    print("🥉 Construyendo capa Bronze...")
    con.execute("CREATE TABLE IF NOT EXISTS bronze_orders AS SELECT * FROM df_raw LIMIT 0")
    con.execute("TRUNCATE TABLE bronze_orders")
    con.execute("INSERT INTO bronze_orders SELECT * FROM df_raw")

    # 🥈 CAPA SILVER (Datos Limpios y Desanidados)
    print("🥈 Construyendo capa Silver...")
    con.execute("""
        CREATE OR REPLACE TABLE silver_sales AS 
        SELECT 
            id as order_id,
            folio,
            CAST(business_date AS DATE) as fecha_venta,
            customer_info->>'name' as nombre_cliente,
            fulfillment_method as metodo_entrega,
            total_amount as total_venta,
            CAST(raw_payload->'financials'->>'sub' AS DOUBLE) as subtotal_neto,
            CAST(raw_payload->'financials'->>'disc' AS DOUBLE) as descuento_aplicado
        FROM bronze_orders
    """)

    # 🥇 CAPA GOLD (Métricas de Negocio para el Dashboard)
    print("🥇 Construyendo capa Gold...")
    con.execute("""
        CREATE OR REPLACE TABLE gold_kpis_diarios AS 
        SELECT 
            fecha_venta,
            COUNT(order_id) as cantidad_ordenes,
            SUM(total_venta) as ingresos_totales,
            SUM(descuento_aplicado) as total_descuentos
        FROM silver_sales
        GROUP BY fecha_venta
        ORDER BY fecha_venta DESC
    """)

    print("✅ Pipeline ejecutado con éxito. Datos listos en MotherDuck.")

if __name__ == "__main__":
    run_pipeline()