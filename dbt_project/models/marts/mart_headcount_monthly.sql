-- Month-end headcount, joiners and leavers. Records without a usable hire date
-- cannot be placed in time, so they stay out and appear as issues instead.
with months as (
    select cast(month_start as date) as month_start,
           cast(last_day(month_start) as date) as month_end
    from generate_series(date '2024-01-01', date '{{ var("as_of") }}', interval 1 month) as t(month_start)
),
people as (
    select * from {{ ref('dim_employee') }}
    where hire_date is not null
      and (termination_date is null or termination_date >= hire_date)
)
select
    m.month_start,
    count(*) filter (where p.hire_date <= m.month_end
        and (p.termination_date is null or p.termination_date > m.month_end)) as headcount,
    count(*) filter (where p.hire_date between m.month_start and m.month_end) as joiners,
    count(*) filter (where p.termination_date between m.month_start and m.month_end) as leavers
from months m
cross join people p
group by 1
order by 1
