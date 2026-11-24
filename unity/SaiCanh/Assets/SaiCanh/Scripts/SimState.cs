// Trạng thái chung của chuyến bay mà buồng lái, âm thanh, checklist và HUD cùng đọc.
using UnityEngine;

namespace SaiCanh
{
    public class SimState
    {
        public FlightModel model;
        public AircraftSystems sys = new AircraftSystems();
        public FlightControls ctl = new FlightControls();
        /// <summary>Áp suất quy về mực nước biển thực tế hôm nay (inHg) — đọc trên ATIS.</summary>
        public double qnh = 30.12;
        public Vector3 windMap; // m/s hệ bản đồ (hướng khối khí chuyển động)
        public double windFromDeg = 340, windKt = 6;
        public float timeOfDayHours = 8.5f;
        public float simTime;
        public double heading, pitchDeg, rollDeg, turnRate, slip;
        public double vsFpm, altFt, iasKt, gsKt, trackDeg, aglFt;
        public double comActive = 122.800, comStby = 118.300, navActive = 110.50, navStby = 113.70;
        public double obs = 360;
        public int gpsZoom = 1; // 0: 2 km, 1: 5 km, 2: 12 km
        public bool annTest;
        public bool hideYokes;

        /// <summary>Độ cao áp kế chỉ (ft) theo núm Kollsman.</summary>
        public double IndicatedAltFt { get { return altFt + (sys.baro - qnh) * 1000; } }
    }
}
