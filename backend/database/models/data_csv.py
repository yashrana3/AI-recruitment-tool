# # data.py
# import csv
# import os
# from typing import List, Dict, Any
# from datetime import datetime
# DATA_DIR = "../../data/"
# # Constants for CSV paths and fields
# CSV_PATH_JOBS = DATA_DIR+"jobs_data.csv"
# CSV_FIELDS = [
#     "id", "created_at", "location", "country", "title", "description",
#     "seniority", "job_url", "company_name", "company_website",
#     "company_industry", "company_keywords", "email"
# ]
# file_mapping = {"technologies": {
#                      "filename": "keywords.csv",
#                      "raw": "keywords",
#                      "mapped": "slug"},
#                 "countries": {
#                      "filename": "countries.csv",
#                      "raw": "country",
#                      "mapped": "code"},
#                 "industries": {
#                      "filename": "industries.csv",
#                      "raw": "industry",
#                      "mapped": "industry_id"},
#                 "mantiks_countries": {
#                     "filename": "mantiks_countries.csv",
#                     "raw": "country",
#                     "mapped": "location_id"
#                 }}
# CSV_PATH_RESUMES = DATA_DIR+ "resumes_data.csv"

# CSV_PATH_MATCHED = DATA_DIR+ "matched_data.csv"
# MATCHED_FIELDS = ["job_id", "resume_id", "score"]



# CSV_PATH_SCHEDULERS = DATA_DIR+ "schedulers.csv"
# SCHEDULER_FIELDS = [
#     "scheduler_id", "location", "job_title", "skills", "limit",
#     "is_active", "last_run"
# ]


# def read_jobs_from_csv() -> List[Dict[str, Any]]:
#     if not os.path.exists(CSV_PATH_JOBS):
#         return []
#     jobs = []
#     with open(CSV_PATH_JOBS, mode="r", newline="", encoding="utf-8") as file:
#         reader = csv.DictReader(file)
#         for row in reader:
#             # Convert keywords back to list
#             row["company_keywords"] = (
#                 row["company_keywords"].split(",")
#                 if row.get("company_keywords")
#                 else []
#             )
#             jobs.append(row)
#     return jobs



# def save_jobs_to_csv(jobs: List[Dict[str, Any]]):
#     """Append jobs to CSV.
#     Creates file + headers if not exists.
#     Skips rows whose 'id' already exists.
#     """
#     if not jobs:
#         return

#     # Ensure directory exists
#     os.makedirs(os.path.dirname(CSV_PATH_JOBS), exist_ok=True)

#     # Collect existing IDs
#     existing_ids = set()
#     if os.path.exists(CSV_PATH_JOBS):
#         with open(CSV_PATH_JOBS, mode="r", newline="", encoding="utf-8") as file:
#             reader = csv.DictReader(file)
#             for row in reader:
#                 if "id" in row:
#                     existing_ids.add(str(row["id"]))

#     file_exists = os.path.exists(CSV_PATH_JOBS)

#     with open(CSV_PATH_JOBS, mode="a", newline="", encoding="utf-8") as file:
#         writer = csv.DictWriter(file, fieldnames=CSV_FIELDS)

#         # Write header only once
#         if not file_exists:
#             writer.writeheader()

#         for job in jobs:
#             job_id = str(job.get("id"))
#             if job_id in existing_ids:
#                 continue  # Skip duplicate

#             # Convert list → string for CSV safety
#             job["company_keywords"] = ",".join(
#                 job.get("company_keywords", [])
#             )

#             writer.writerow(job)
#             existing_ids.add(job_id)


# def save_resumes_to_csv(rows: List[Dict[str, Any]]):
#     """Append resume matches to CSV.
#     Creates file + headers if not exists.
#     Skips rows whose 'id' already exists.
#     Uses dynamic fieldnames based on the first row.
#     """
#     if not rows:
#         return

#     # Ensure directory exists
#     os.makedirs(os.path.dirname(CSV_PATH_RESUMES), exist_ok=True)

#     fieldnames = list(rows[0].keys())

#     # Collect existing IDs
#     existing_ids = set()
#     if os.path.exists(CSV_PATH_RESUMES):
#         with open(CSV_PATH_RESUMES, mode="r", newline="", encoding="utf-8") as file:
#             reader = csv.DictReader(file)
#             for row in reader:
#                 if "id" in row:
#                     existing_ids.add(str(row["id"]))

#     file_exists = os.path.exists(CSV_PATH_RESUMES)

#     with open(CSV_PATH_RESUMES, mode="a", newline="", encoding="utf-8") as file:
#         writer = csv.DictWriter(file, fieldnames=fieldnames)

#         # Write header only once
#         if not file_exists:
#             writer.writeheader()

#         for row in rows:
#             row_id = str(row.get("id"))
#             if row_id in existing_ids:
#                 continue  # Skip duplicate

#             # Convert lists → comma-separated strings
#             for key, value in list(row.items()):
#                 if isinstance(value, list):
#                     row[key] = ",".join(str(v) for v in value)

#             writer.writerow(row)
#             existing_ids.add(row_id)


# def read_matched_from_csv() -> List[Dict[str, Any]]:
#     if not os.path.exists(CSV_PATH_MATCHED):
#         return []
#     matched = []
#     with open(CSV_PATH_MATCHED, mode="r", newline="", encoding="utf-8") as file:
#         reader = csv.DictReader(file)
#         for row in reader:
#             matched.append(row)
#     return matched


# def save_matched_to_csv(matched: List[Dict[str, Any]]):
#     """Append matched data to CSV. Creates file + headers if not exists."""
#     file_exists = os.path.exists(CSV_PATH_MATCHED)
#     # Ensure directory exists
#     os.makedirs(os.path.dirname(CSV_PATH_MATCHED), exist_ok=True)
#     with open(CSV_PATH_MATCHED, mode="a", newline="", encoding="utf-8") as file:
#         writer = csv.DictWriter(file, fieldnames=MATCHED_FIELDS)
#         # Write header only once
#         if not file_exists:
#             writer.writeheader()
#         for entry in matched:
#             writer.writerow(entry)


# def read_resumes_from_csv() -> List[Dict[str, Any]]:
#     if not os.path.exists(CSV_PATH_RESUMES):
#         return []
#     resumes = []
#     with open(CSV_PATH_RESUMES, mode="r", newline="", encoding="utf-8") as file:
#         reader = csv.DictReader(file)
#         for row in reader:
#             # Convert comma-separated strings back to lists where applicable
#             for key, value in row.items():
#                 if value and isinstance(value, str) and ',' in value:
#                     row[key] = [v.strip() for v in value.split(',') if v.strip()]
#                 else:
#                     row[key] = value  # Keep as is
#             resumes.append(row)
#     return resumes


# def load_mappings(datapoint: str) -> List[Dict[str, str]]:
#     CSV_PATH = DATA_DIR+  "mapping/"+ file_mapping[datapoint]['filename']
#     final_data = []
#     if not os.path.exists(CSV_PATH):
#         return final_data
#     with open(CSV_PATH, newline="", encoding="utf-8") as csvfile:
#         reader = csv.DictReader(csvfile)
#         for row in reader:
#             final_data.append({
#                 "raw": row.get(file_mapping[datapoint]["raw"], "").strip(),
#                 "mapped": row.get(file_mapping[datapoint]["mapped"], "").strip(),
#             })
#     return final_data


# def init_scheduler_csv():
#     os.makedirs(os.path.dirname(CSV_PATH_SCHEDULERS), exist_ok=True)
#     if not os.path.exists(CSV_PATH_SCHEDULERS):
#         with open(CSV_PATH_SCHEDULERS, "w", newline="", encoding="utf-8") as f:
#             writer = csv.writer(f)
#             writer.writerow(SCHEDULER_FIELDS)


# def get_scheduler_by_id(scheduler_id: str) -> Dict[str, Any] | None:
#     if not os.path.exists(CSV_PATH_SCHEDULERS):
#         return None
#     with open(CSV_PATH_SCHEDULERS, newline="", encoding="utf-8") as f:
#         reader = csv.DictReader(f)
#         for row in reader:
#             if row["scheduler_id"] == scheduler_id:
#                 return row
#     return None


# def update_last_run(scheduler_id: str):
#     if not os.path.exists(CSV_PATH_SCHEDULERS):
#         return
#     rows = []
#     with open(CSV_PATH_SCHEDULERS, newline="", encoding="utf-8") as f:
#         reader = csv.DictReader(f)
#         for row in reader:
#             if row["scheduler_id"] == scheduler_id:
#                 row["last_run"] = datetime.utcnow().isoformat()
#             rows.append(row)
#     with open(CSV_PATH_SCHEDULERS, "w", newline="", encoding="utf-8") as f:
#         writer = csv.DictWriter(f, fieldnames=SCHEDULER_FIELDS)
#         writer.writeheader()
#         writer.writerows(rows)


# def get_all_schedulers() -> List[Dict[str, Any]]:
#     if not os.path.exists(CSV_PATH_SCHEDULERS):
#         return []
#     schedulers = []
#     with open(CSV_PATH_SCHEDULERS, newline="", encoding="utf-8") as f:
#         reader = csv.DictReader(f)
#         for row in reader:
#             schedulers.append(row)
#     return schedulers


# def delete_scheduler(scheduler_id: str) -> Dict[str, Any]:
#     """Delete a scheduler from CSV."""
#     if not os.path.exists(CSV_PATH_SCHEDULERS):
#         raise ValueError("No schedulers found")
#     rows = []
#     found = False
#     # Read all rows and skip the one to delete
#     with open(CSV_PATH_SCHEDULERS, newline="", encoding="utf-8") as f:
#         reader = csv.DictReader(f)
#         for row in reader:
#             if row["scheduler_id"] == scheduler_id:
#                 found = True
#                 continue  # skip this row
#             rows.append(row)
#     if not found:
#         raise ValueError("Scheduler not found")
#     # Write back the remaining rows
#     with open(CSV_PATH_SCHEDULERS, "w", newline="", encoding="utf-8") as f:
#         writer = csv.DictWriter(f, fieldnames=SCHEDULER_FIELDS)
#         writer.writeheader()
#         writer.writerows(rows)
#     return {"message": "Scheduler deleted successfully", "scheduler_id": scheduler_id}