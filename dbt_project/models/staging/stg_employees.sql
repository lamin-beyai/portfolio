-- Types the raw extract without dropping anything. A value that cannot be read
-- becomes null here, and the raw text stays beside it so the checks can see why.
with source as (
    select *, row_number() over () as source_row
    from read_csv('{{ var("raw_csv") }}', header = true, all_varchar = true)
)
select
    source_row,
    nullif(trim(employee_id), '') as employee_id,
    trim(first_name) as first_name,
    trim(last_name) as last_name,
    nullif(trim(work_email), '') as work_email,
    nullif(trim(department), '') as department,
    nullif(trim(cost_centre), '') as cost_centre,
    trim(job_title) as job_title,
    trim(job_level) as job_level,
    nullif(trim(manager_id), '') as manager_id,
    trim(country) as country,
    nullif(trim(hire_date), '') as hire_date_raw,
    try_cast(trim(hire_date) as date) as hire_date,
    try_cast(nullif(trim(termination_date), '') as date) as termination_date,
    trim(employment_status) as employment_status,
    nullif(trim(contract_type), '') as contract_type,
    try_cast(nullif(trim(contract_end_date), '') as date) as contract_end_date,
    try_cast(trim(fte) as double) as fte,
    try_cast(trim(annual_salary_eur) as integer) as annual_salary_eur,
    try_cast(trim(date_of_birth) as date) as date_of_birth
from source
