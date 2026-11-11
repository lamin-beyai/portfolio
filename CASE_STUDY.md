# Case study: making data quality a business decision

**The problem.** HR data errors cost money in ways nobody sees until payroll or an audit. Teams usually fix what they notice, not what matters most.

**The approach.** Find every issue with explicit rules, explain each one in business language, and rank the work by risk per hour rather than by volume.

**What was built.** A dbt and DuckDB pipeline, 21 rules, a test harness with planted errors, and a browser workbench where someone can fix records or check their own file privately.

**The result.** On fictional data, 91 of 91 planted errors were found, with no false alarms and none of the 9 valid unusual records flagged. In the payroll challenge, working through the most common problems first protects €17,138. The best plan protects €40,622 in the same 4 hours, using the exercise's assumed risk figures.

**What testing caught.** The first run looked perfect, so the tests were repeated on new random datasets. That exposed a bug: a fictional CEO's hire date was changed after their birth date was generated, making them appear underage. The rule was right and the data generator was wrong.

**Second problem: customers.** K-means on recency, frequency and spend recovered the planted customer groups with 99.3% agreement. The business point is that spend alone misleads: Champions spend the most, but contacting them loses money under the exercise's assumptions because they would buy anyway.

**Limits.** This has never run on real company data. Risk figures and campaign uplift are assumptions. In practice, uplift should come from a holdout test.

**The real-world basis.** At Capital Fund Management, I proposed and built a Python data-quality system for SAP SuccessFactors that ran 91+ checks across 500+ employee records and saved about 20 hours of manual reconciliation a week. Nothing from that system is reused here.
