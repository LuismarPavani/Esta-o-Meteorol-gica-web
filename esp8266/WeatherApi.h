// Envio das leituras para o painel (Vercel + Supabase).
// Inclua no seu .ino:  #include "WeatherApi.h"  e chame  sendReading(temp, hum);  a cada 15 min.
#pragma once
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// --- Ajuste estes valores ---
const char* API_URL    = "https://SEU-PROJETO.vercel.app/api/readings";
const char* DEVICE_KEY = "a-mesma-DEVICE_KEY-do-vercel";
const char* DEVICE_ID  = "esp8266-sala";   // igual ao ID cadastrado no painel
const char* FIRMWARE   = "1.0";
const long  CITY_ID    = 3463011;          // código da cidade na OpenWeatherMap (Franca)
const char* CITY_NAME  = "Franca";

// Bateria lida no A0. No NodeMCU o A0 já tem divisor interno (aceita 0 a 3,2 V).
// Uma LiPo chega a 4,2 V, então use um divisor externo e informe o fator aqui
// (dois resistores iguais => 2.0). Meça com multímetro e calibre.
const float BATTERY_DIVIDER = 2.0f;
const float BATT_EMPTY = 3.2f;   // 0 %
const float BATT_FULL  = 4.2f;   // 100 %
const float BATT_MIN_PRESENT = 2.5f; // abaixo disso considera "sem bateria"

struct Battery { bool active; int percent; float volts; };

Battery readBattery() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(A0); delay(5); }
  float volts = (sum / 10.0f) / 1023.0f * 3.2f * BATTERY_DIVIDER;
  Battery b;
  b.active = volts >= BATT_MIN_PRESENT;
  b.volts = b.active ? volts : 0;
  b.percent = b.active ? constrain((int)((volts - BATT_EMPTY) / (BATT_FULL - BATT_EMPTY) * 100), 0, 100) : 0;
  return b;
}

bool sendReading(float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) return false;
  Battery batt = readBattery();

  WiFiClientSecure client;
  client.setInsecure();                 // simples; o TLS do ESP8266 não valida bem os certificados do Vercel
  client.setBufferSizes(1024, 512);     // economiza RAM no TLS
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(client, API_URL)) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String body = String("{\"device_id\":\"") + DEVICE_ID +
    "\",\"temperature\":" + String(temperature, 1) +
    ",\"humidity\":" + String(humidity, 1) +
    ",\"ip\":\"" + WiFi.localIP().toString() +
    "\",\"rssi\":" + WiFi.RSSI() +
    ",\"city_id\":" + CITY_ID +
    ",\"city_name\":\"" + CITY_NAME +
    "\",\"firmware\":\"" + FIRMWARE +
    "\",\"battery_active\":" + (batt.active ? "true" : "false") +
    ",\"battery\":" + batt.percent +
    ",\"battery_voltage\":" + String(batt.volts, 2) + "}";

  int code = http.POST(body);
  Serial.printf("POST /api/readings -> %d\n", code);
  http.end();
  return code == 200;
}
