"""
FitPlan NZ API Tests - New Features (Iteration 2)
Tests for: Task start date override, dependencies, reordering, sort by date
"""
import pytest
import requests


class TestTaskStartDateOverride:
    """Test manual start date override for tasks"""
    
    def test_create_task_with_custom_start_date(self, api_client, base_url):
        """Create task with custom start date instead of project start"""
        # Create project starting 2026-05-01
        project_payload = {
            "name": "TEST_StartDate_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        assert project_response.status_code == 200
        project_id = project_response.json()["id"]
        
        # Create task with custom start date (2026-06-01)
        task_payload = {
            "name": "TEST_Custom_Start_Task",
            "duration_days": 5,
            "quoted_hours": 100,
            "start_date": "2026-06-01",
            "order": 0,
            "dependencies": []
        }
        task_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task_payload)
        assert task_response.status_code == 200
        
        task = task_response.json()
        # Task should use custom start date, not project start date
        assert task["start_date"] == "2026-06-01"
        assert task["name"] == task_payload["name"]
        
        # GET task to verify persistence
        get_response = api_client.get(f"{base_url}/api/tasks/{task['id']}")
        assert get_response.status_code == 200
        fetched_task = get_response.json()
        assert fetched_task["start_date"] == "2026-06-01"
    
    def test_update_task_with_start_date(self, api_client, base_url):
        """Update task to add custom start date"""
        # Create project and task
        project_payload = {
            "name": "TEST_Update_StartDate_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        task_payload = {
            "name": "TEST_Task_To_Update_Date",
            "duration_days": 5,
            "quoted_hours": 100,
            "order": 0
        }
        task_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task_payload)
        task_id = task_response.json()["id"]
        
        # Update task with custom start date
        update_payload = {
            "start_date": "2026-06-15"
        }
        update_response = api_client.put(f"{base_url}/api/tasks/{task_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated_task = update_response.json()
        assert updated_task["start_date"] == "2026-06-15"
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/tasks/{task_id}")
        assert get_response.status_code == 200
        assert get_response.json()["start_date"] == "2026-06-15"


class TestTaskDependencies:
    """Test task dependency linking and date recalculation"""
    
    def test_create_task_with_dependencies(self, api_client, base_url):
        """Create tasks with dependencies and verify date calculation"""
        # Create project
        project_payload = {
            "name": "TEST_Dependencies_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        # Create first task (no dependencies)
        task1_payload = {
            "name": "TEST_Task_1_Foundation",
            "duration_days": 5,
            "quoted_hours": 100,
            "order": 0,
            "dependencies": []
        }
        task1_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task1_payload)
        assert task1_response.status_code == 200
        task1 = task1_response.json()
        task1_id = task1["id"]
        
        # Create second task depending on first
        task2_payload = {
            "name": "TEST_Task_2_Dependent",
            "duration_days": 3,
            "quoted_hours": 50,
            "order": 1,
            "dependencies": [task1_id]
        }
        task2_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task2_payload)
        assert task2_response.status_code == 200
        task2 = task2_response.json()
        
        # Task 2 should start after Task 1 ends
        assert task2["dependencies"] == [task1_id]
        # Task 2 start date should be after Task 1 end date
        assert task2["start_date"] > task1["end_date"]
        
        # Verify persistence
        get_response = api_client.get(f"{base_url}/api/tasks/{task2['id']}")
        assert get_response.status_code == 200
        fetched_task2 = get_response.json()
        assert fetched_task2["dependencies"] == [task1_id]
    
    def test_update_task_dependencies(self, api_client, base_url):
        """Update task to add dependencies"""
        # Create project with 2 tasks
        project_payload = {
            "name": "TEST_Update_Dependencies_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        # Create task A
        taskA_payload = {
            "name": "TEST_Task_A",
            "duration_days": 5,
            "order": 0
        }
        taskA_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=taskA_payload)
        taskA_id = taskA_response.json()["id"]
        
        # Create task B (no dependencies initially)
        taskB_payload = {
            "name": "TEST_Task_B",
            "duration_days": 3,
            "order": 1
        }
        taskB_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=taskB_payload)
        taskB_id = taskB_response.json()["id"]
        
        # Update task B to depend on task A
        update_payload = {
            "dependencies": [taskA_id]
        }
        update_response = api_client.put(f"{base_url}/api/tasks/{taskB_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated_taskB = update_response.json()
        assert updated_taskB["dependencies"] == [taskA_id]
        
        # Verify dates were recalculated
        taskA_get = api_client.get(f"{base_url}/api/tasks/{taskA_id}").json()
        assert updated_taskB["start_date"] > taskA_get["end_date"]


class TestTaskReordering:
    """Test task reordering functionality"""
    
    def test_reorder_tasks(self, api_client, base_url):
        """Reorder tasks using reorder-tasks endpoint"""
        # Create project with 3 tasks
        project_payload = {
            "name": "TEST_Reorder_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        # Create 3 tasks
        task1_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json={
            "name": "TEST_Task_1", "duration_days": 3, "order": 0
        })
        task1_id = task1_response.json()["id"]
        
        task2_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json={
            "name": "TEST_Task_2", "duration_days": 3, "order": 1
        })
        task2_id = task2_response.json()["id"]
        
        task3_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json={
            "name": "TEST_Task_3", "duration_days": 3, "order": 2
        })
        task3_id = task3_response.json()["id"]
        
        # Reorder: swap task 1 and task 3 (new order: 3, 2, 1)
        reorder_payload = {
            "task_ids": [task3_id, task2_id, task1_id]
        }
        reorder_response = api_client.post(
            f"{base_url}/api/projects/{project_id}/reorder-tasks",
            json=reorder_payload
        )
        assert reorder_response.status_code == 200
        
        # Verify new order by getting project
        project_get = api_client.get(f"{base_url}/api/projects/{project_id}")
        assert project_get.status_code == 200
        project = project_get.json()
        
        tasks = project["tasks"]
        assert len(tasks) == 3
        # Tasks should be in new order
        assert tasks[0]["id"] == task3_id
        assert tasks[0]["order"] == 0
        assert tasks[1]["id"] == task2_id
        assert tasks[1]["order"] == 1
        assert tasks[2]["id"] == task1_id
        assert tasks[2]["order"] == 2


class TestSortByDate:
    """Test auto-sort tasks by date functionality"""
    
    def test_sort_tasks_by_date(self, api_client, base_url):
        """Sort tasks by their start date"""
        # Create project
        project_payload = {
            "name": "TEST_Sort_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        # Create tasks with different start dates (out of order)
        task1_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json={
            "name": "TEST_Task_June", "duration_days": 3, "start_date": "2026-06-01", "order": 0
        })
        task1_id = task1_response.json()["id"]
        
        task2_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json={
            "name": "TEST_Task_May", "duration_days": 3, "start_date": "2026-05-15", "order": 1
        })
        task2_id = task2_response.json()["id"]
        
        task3_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json={
            "name": "TEST_Task_July", "duration_days": 3, "start_date": "2026-07-01", "order": 2
        })
        task3_id = task3_response.json()["id"]
        
        # Sort by date
        sort_response = api_client.post(f"{base_url}/api/projects/{project_id}/sort-by-date")
        assert sort_response.status_code == 200
        
        # Verify tasks are now sorted by date
        project_get = api_client.get(f"{base_url}/api/projects/{project_id}")
        assert project_get.status_code == 200
        project = project_get.json()
        
        tasks = project["tasks"]
        assert len(tasks) == 3
        # Should be sorted: May, June, July
        assert tasks[0]["id"] == task2_id  # May
        assert tasks[0]["name"] == "TEST_Task_May"
        assert tasks[1]["id"] == task1_id  # June
        assert tasks[1]["name"] == "TEST_Task_June"
        assert tasks[2]["id"] == task3_id  # July
        assert tasks[2]["name"] == "TEST_Task_July"
        
        # Verify order field was updated
        assert tasks[0]["order"] == 0
        assert tasks[1]["order"] == 1
        assert tasks[2]["order"] == 2
