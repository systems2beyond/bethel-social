# Enterprise Monitoring Setup Guide

This guide details the **manual configuration steps** required to complete the Enterprise Monitoring Setup (V2). These actions must be performed in the Google Cloud Platform (GCP) Console and Firebase Console, as they cannot be fully automated via code.

## 1. Enable BigQuery Export
*Connect your Analytics data to BigQuery for advanced querying and custom dashboards.*

1.  Go to the **[Firebase Console](https://console.firebase.google.com/)**.
2.  Click **Project Settings** (gear icon) -> **Integrations**.
3.  Find the **BigQuery** card and click **Link**.
4.  **Configure Export**:
    *   Select **Google Analytics**.
    *   Toggle **"Daily export"** (Standard).
    *   *(Optional)* Toggle **"Streaming export"** (Real-time, incurs extra costs).
    *   Select the **Dataset location** (e.g., `us-central1`).
5.  Click **Link to BigQuery**.
    *   *Note: Data will start flowing within 24 hours.*

## 2. Configure GCP Budget Alerts
*Prevent cost overruns for Cloud Run, Firestore, and BigQuery.*

1.  Go to the **[GCP Billing Console](https://console.cloud.google.com/billing)**.
2.  Select **Budgets & alerts** from the left menu.
3.  Click **Create Budget**.
4.  **Scope**:
    *   **Time range**: Monthly.
    *   **Services**: Select `Cloud Run`, `Cloud Firestore`, `BigQuery`, `Cloud Storage`.
5.  **Amount**:
    *   Set your target monthly budget (e.g., $50).
    *   Check **"Include credits in cost"** (to alert on net cost).
6.  **Actions (Thresholds)**:
    *   Add thresholds at **50%**, **90%**, and **100%** of budget.
    *   Check **"Email alerts to billing admins"**.
    *   *(Optional)* Connect to a Pub/Sub topic for Slack notifications.
7.  Click **Finish**.

## 3. Set Up Looker Studio Dashboard
*Create a visual dashboard for Errors, Bible Usage, and Collaboration Stats.*

1.  Go to **[Looker Studio](https://lookerstudio.google.com/)**.
2.  Click **Create** -> **Report**.
3.  **Add Data Source**:
    *   Select **BigQuery**.
    *   Choose your project -> **analytics_123...** dataset -> **events_** table.
4.  **Create Charts**:
    *   **Error Rate**: Time series chart filtered by `event_name = 'error_event'`.
    *   **Trending Verses**: Bar chart of `event_name = 'bible_view'`, dimension `event_params.book` + `event_params.chapter`.
    *   **Active Sessions**: Scorecard of `event_name = 'collab_created'` (Count).
5.  **Save** the report as "Bethel Alpha Monitoring".

## 4. Advanced Log-Based Alerts (Latency)
*Alert when slow traces exceed a threshold.*

1.  Go to **[Cloud Logging](https://console.cloud.google.com/logs)**.
2.  Enter query:
    ```text
    resource.type="cloud_run_revision"
    httpRequest.latency > "1s"
    ```
3.  Click **Create Metric**.
    *   **Name**: `high_latency_requests`.
    *   **Type**: Counter.
4.  Go to **[Cloud Monitoring](https://console.cloud.google.com/monitoring)** -> **Alerting**.
5.  Click **Create Policy**.
6.  **Select Metric**: `high_latency_requests`.
7.  **Condition**: "Is above 0" for 5 minutes.
8.  **Notification Channel**: Select Email (or setup Slack).
9.  Name it **"High Latency Alert"** and Save.

---
**Next Steps**: Once the above is configured, the `AnalyticsService` events implemented in the code will flow into these systems automatically.
