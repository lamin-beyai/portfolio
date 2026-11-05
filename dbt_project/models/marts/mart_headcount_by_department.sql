select
    coalesce(department, 'Unassigned') as department,
    count(*) as active_headcount,
    round(avg(fte), 2) as average_fte
from {{ ref('dim_employee') }}
where employment_status = 'Active'
group by 1
order by 2 desc
