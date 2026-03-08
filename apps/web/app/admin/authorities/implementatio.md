# Authorities Page Design Document

## Civic Complaint Management System (JanSamadhan / PS-CRM)

---

# 1. Purpose of the Authorities Page

The **Authorities Page (`/authorities`)** is responsible for managing the different **government departments responsible for resolving civic complaints**.

In the system architecture, authorities represent departments such as:

* Municipal Corporation
* Electricity Board
* Water Supply Department
* Road Maintenance Authority
* Police Department
* Sanitation Department

Each authority supervises **workers**, handles **specific complaint categories**, and manages **active tickets**.

Instead of using a traditional table layout, the Authorities page should use a **card-based layout**, which better represents departments as operational units rather than individual records.

---

# 2. Page Route

The authorities management interface should be accessible through:

```text
/authorities
```

This page allows administrators to monitor and manage all departments in the system.

---

# 3. Page Layout

The Authorities page should display authorities in a **responsive grid layout of cards**.

Example layout:

```
-------------------------------------------------
Authorities
-------------------------------------------------

[ Municipal Corporation ]   [ Electricity Board ]
[ Water Supply Dept ]       [ Road Maintenance ]
[ Police Department ]       [ Sanitation Dept ]
```

Each card represents a **single department**.

This layout improves visual clarity and allows administrators to quickly assess the operational status of departments.

---

# 4. Authority Card Structure

Each authority should be represented using a **card component** that summarizes key department information.

Example authority card:

```
------------------------------------------------
Municipal Corporation
------------------------------------------------
Workers: 18
Active Tickets: 124
Resolved Today: 14

Categories:
Garbage Collection
Road Maintenance
Drainage Issues

[ View Department ]   [ Assign Worker ]
------------------------------------------------
```

The card provides a quick overview of the department's workload and available personnel.

---

# 5. Authority Card Components

Each authority card should contain the following internal components:

* Authority Header
* Authority Statistics
* Assigned Categories
* Authority Actions

Structure:

```
AuthorityCard
 ├── AuthorityHeader
 ├── AuthorityStats
 ├── AssignedCategories
 └── AuthorityActions
```

---

# 6. Authority Statistics

Each card should display operational statistics for the department.

Recommended metrics:

* Total workers in the department
* Number of active complaints
* Complaints resolved today
* Average resolution time

Example display:

```
Workers: 12
Active Tickets: 48
Resolved Today: 9
```

These statistics allow administrators to quickly understand the **department workload and efficiency**.

---

# 7. Assigned Categories

Authorities handle specific complaint categories. These categories should be displayed on the card.

Example:

```
Categories:
Streetlight Failure
Power Outage
Electrical Pole Damage
```

This mapping helps the system determine **which department should receive a complaint** when it is filed.

---

# 8. Authority Actions

Each authority card should provide quick management actions.

Typical actions include:

* View department details
* Assign worker
* Edit authority information

Example interface:

```
[ View Department ]   [ Assign Worker ]
```

These actions allow administrators to manage departments without navigating multiple pages.

---

# 9. Authority Detail Page

Clicking on an authority card should open a detailed department page.

Route format:

```
/authorities/[authorityId]
```

Example:

```
/authorities/electricity-board
```

This page provides deeper operational insights and management tools.

---

# 10. Authority Detail Page Layout

The authority detail page can include multiple tabs for managing department operations.

Example layout:

```
------------------------------------------------
Electricity Board
------------------------------------------------

Tabs:
Workers | Tickets | Categories | Analytics
```

Each tab serves a specific purpose.

### Workers Tab

Displays all workers assigned to the department.

### Tickets Tab

Shows all complaints handled by the authority.

### Categories Tab

Lists complaint categories assigned to the department.

### Analytics Tab

Displays performance metrics and workload trends.

---

# 11. Worker Assignment

Administrators should be able to assign workers to authorities.

Example interface:

```
Assign Worker

Select Worker:
• Ramesh Patel
• Arjun Kumar
• Sanjay Verma
```

This ensures workers are distributed across departments efficiently.

---

# 12. Grid Layout System

The Authorities page should use a responsive grid layout to display cards.

Example configuration:

```
Mobile: 1 column
Tablet: 2 columns
Desktop: 3 columns
```

Example visual layout:

```
--------------------------------------------------------
| Municipal Corp | Electricity Board | Water Supply   |
--------------------------------------------------------
| Road Dept      | Sanitation Dept   | Police Dept    |
--------------------------------------------------------
```

This layout ensures the page remains visually organized across different screen sizes.

---

# 13. Workload Indicator

To improve system monitoring, each authority card should display a **workload indicator**.

Example indicators:

```
🟢 Normal
🟡 Busy
🔴 Overloaded
```

This helps administrators quickly identify departments that require additional resources.

---

# 14. Page Components

The `/authorities` page should be constructed using modular components.

Recommended component structure:

```
AuthoritiesPage
 ├── AuthoritiesHeader
 ├── AuthoritySearch
 ├── AuthorityFilters
 └── AuthoritiesGrid
       └── AuthorityCard
```

This structure keeps the code modular and easier to maintain.

---

# 15. Folder Structure

Recommended folder structure within the project:

```
/authorities
   page.tsx
   components/
       AuthoritiesHeader.tsx
       AuthoritySearch.tsx
       AuthorityFilters.tsx
       AuthoritiesGrid.tsx
       AuthorityCard.tsx
```

This ensures all authority-related components remain logically grouped.

---

# 16. Benefits of Card-Based Authority Layout

Using cards for authorities provides several advantages:

* Clear visual representation of departments
* Quick overview of operational statistics
* Easy access to department actions
* Better user experience compared to tables
* Scalable interface for adding more departments

This design mirrors modern **enterprise dashboards and internal government systems**.

---

# 17. Summary

The Authorities Page serves as the **department management interface** of the civic complaint platform.

Key features include:

* Grid layout displaying departments as cards
* Operational statistics for each authority
* Category mapping for complaint routing
* Worker assignment capabilities
* Detailed department view pages

By implementing this design, the system allows administrators to efficiently manage departments and ensure complaints are routed and resolved effectively.
