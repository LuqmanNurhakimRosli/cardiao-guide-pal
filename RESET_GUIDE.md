# 📘 Panduan Set Semula Sistem CDSS (Reset Guide)

Dokumen ini menyediakan langkah-langkah mudah untuk mengembalikan (_reset/revert_) sistem CDSS kepada **keadaan asal (Default Fasa 1)** di mana hanya **12 pesakit standard rujukan (_benchmark cases_ `P001` - `P012`)** digunakan tanpa memuatkan dataset pesakit hospital HASA UiTM.

---

## 1. Ringkasan Mod Sistem

| Mod Sistem                            | Bil. Pesakit                                  | Keterangan                                                                                      |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Default Fasa 1 (Asal / Benchmark)** | **12 Pesakit** (`P001` – `P012`)              | Hanya pesakit rujukan standard untuk demonstrasi bersih & pengesahan peraturan klinikal.        |
| **Fasa 2 / 3 / 4 (Dual-Cohort)**      | **505 Pesakit** (12 Benchmark + 493 Hospital) | Memuatkan 493 pesakit sebenar hospital yang telah di-_anonymize_ untuk kajian & audit klinikal. |

---

## 2. Cara-Cara Mengembalikan Sistem ke Mod Asal (Fasa 1)

Anda boleh memilih salah satu daripada 3 kaedah berikut mengikut kesesuaian:

### Kaedah A: Melalui Antaramuka Web (1-Klik Sahaja) ⭐️ _Paling Mudah_

1. Buka laman web CDSS di pelayar: [`http://localhost:8080/patients`](http://localhost:8080/patients).
2. Di bahagian atas kanan senarai pesakit, klik butang **`🔄 Reset to Benchmark (12)`**.
3. Sistem akan serta-merta menapis dan memaparkan hanya 12 pesakit asal `P001` hingga `P012`.

---

### Kaedah B: Melalui Terminal (1 Arahan CLI) 💻

Jika anda atau pembangun ingin membuang fail gabungan dan memastikan pangkalan data kembali 100% kepada fail 12 pesakit rujukan asal:

Buka terminal di dalam folder projek dan jalankan:

```bash
npm run reset:default
```

_Output yang akan dipaparkan:_

```text
========================================================
🔄 SYSTEM RESET SUCCESSFUL: RESTORED TO DEFAULT (FASA 1)
========================================================
✅ Restored 12 core benchmark cases (P001 - P012).
✅ HASA UiTM 493 dataset detached from main patient registry.
✅ System is in pure default state.
```

---

### Kaedah C: Salin Fail Manual (_Manual File Overwrite_) 📁

Jika anda ingin melakukan salinan secara manual tanpa terminal:

1. Buka folder `src/data/`.
2. Salin kandungan dari fail `src/data/benchmark_patients.json`.
3. Tampal (_paste & overwrite_) ke dalam fail `src/data/patients.json`.

---

## 3. Cara Memuatkan Semula Data 493 Pesakit Hospital (_Re-enabling Hospital Cohort_)

Sekiranya pelanggan atau pakar kardiologi ingin mengaktifkan semula modul 493 pesakit hospital sebenar untuk analisis:

Jalankan arahan berikut di terminal:

```bash
npm run load:hospital
```

Sistem akan serta-merta memuatkan semula 493 pesakit hospital bersama 12 pesakit rujukan benchmark (Jumlah: 505 pesakit).

---

## 4. Lokasi Fail Sandaran Keselamatan (_Safety Backup Files_)

Semua dataset disimpan secara berasingan dan selamat di dalam folder `src/data/`:

- **`src/data/benchmark_patients.json`** : Salinan kekal 12 pesakit rujukan asal (P001 - P012). Fail ini tidak akan disentuh atau diubah suai.
- **`src/data/hospital_patients_2024.json`** : Salinan data 493 pesakit hospital yang telah di-_anonymize_ dengan nama olokan (_mock names_).
- **`src/data/patients.json`** : Fail aktif yang dibaca oleh sistem CDSS.

---

## 5. Senarai Semak Pengesahan Sistem (_Verification Checklist_)

Selepas melakukan set semula, anda boleh mengesahkan kelancaran sistem dengan menjalankan:

```bash
npx tsx test-clinical-rules.mjs
```

Semua **26/26 ujian peraturan klinikal** mestilah lulus (`SUMMARY: 26 PASSED, 0 FAILED`).
