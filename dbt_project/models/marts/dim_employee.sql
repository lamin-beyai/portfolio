-- One row per employee ID, for reporting. Duplicate rows keep the first seen.
select * exclude (rn)
from (
    select *, row_number() over (partition by employee_id order by source_row) as rn
    from {{ ref('stg_employees') }}
)
where rn = 1
