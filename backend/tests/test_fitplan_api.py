"""
FitPlan NZ API Tests
Tests for: Auth, Templates, Projects, Tasks, Team, Regions, Holidays
"""
import pytest
import requests

class TestHealth:
    """Health check and basic connectivity"""
    
    def test_api_root(self, api_client, base_url):
        response = api_client.get(f"{base_url}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "FitPlan NZ" in data["message"]


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self, api_client, base_url):
        response = api_client.post(f"{base_url}/api/auth/login", json={
            "name": "Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test User"
        assert "Welcome" in data["message"]
    
    def test_login_empty_name(self, api_client, base_url):
        response = api_client.post(f"{base_url}/api/auth/login", json={
            "name": ""
        })
        assert response.status_code == 400


class TestRegions:
    """NZ Regions endpoint"""
    
    def test_get_regions(self, api_client, base_url):
        response = api_client.get(f"{base_url}/api/regions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check Auckland exists
        auckland = next((r for r in data if r["code"] == "AUK"), None)
        assert auckland is not None
        assert auckland["name"] == "Auckland"


class TestHolidays:
    """NZ Holidays endpoint"""
    
    def test_get_holidays(self, api_client, base_url):
        response = api_client.get(f"{base_url}/api/holidays?region=AUK&year=2026")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have some holidays
        assert len(data) > 0


class TestTemplates:
    """Template CRUD tests"""
    
    def test_get_templates(self, api_client, base_url):
        response = api_client.get(f"{base_url}/api/templates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have 3 default templates
        assert len(data) >= 3
        
        # Check Full Interior Fitout template exists
        full_fitout = next((t for t in data if t["name"] == "Full Interior Fitout"), None)
        assert full_fitout is not None
        assert full_fitout["is_default"] is True
        assert len(full_fitout["tasks"]) == 8
        
        # Verify task names
        task_names = [t["name"] for t in full_fitout["tasks"]]
        expected_tasks = [
            "Steel Partitions", "Aluminium Joinery", "Doors",
            "Gib & Villa Board Linings", "Plastering", "Concealed Grid",
            "2-Way Grid & Tiles", "Feature Linings"
        ]
        for expected in expected_tasks:
            assert expected in task_names


class TestProjects:
    """Project CRUD tests with Create→GET verification"""
    
    def test_create_project_blank(self, api_client, base_url):
        """Create blank project and verify persistence"""
        create_payload = {
            "name": "TEST_Blank_Project",
            "description": "Test blank project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        create_response = api_client.post(f"{base_url}/api/projects", json=create_payload)
        assert create_response.status_code == 200
        
        created_project = create_response.json()
        assert created_project["name"] == create_payload["name"]
        assert created_project["start_date"] == create_payload["start_date"]
        project_id = created_project["id"]
        
        # GET to verify data was actually persisted
        get_response = api_client.get(f"{base_url}/api/projects/{project_id}")
        assert get_response.status_code == 200
        fetched_project = get_response.json()
        assert fetched_project["id"] == project_id
        assert fetched_project["name"] == create_payload["name"]
    
    def test_create_project_with_template(self, api_client, base_url):
        """Create project with Full Interior Fitout template"""
        # Get templates first
        templates_response = api_client.get(f"{base_url}/api/templates")
        templates = templates_response.json()
        full_fitout = next((t for t in templates if t["name"] == "Full Interior Fitout"), None)
        assert full_fitout is not None
        
        create_payload = {
            "name": "TEST_Office_Fitout",
            "description": "Test office fitout project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "template_id": full_fitout["id"],
            "created_by": "Test User"
        }
        create_response = api_client.post(f"{base_url}/api/projects", json=create_payload)
        assert create_response.status_code == 200
        
        created_project = create_response.json()
        project_id = created_project["id"]
        
        # GET project with tasks
        get_response = api_client.get(f"{base_url}/api/projects/{project_id}")
        assert get_response.status_code == 200
        project = get_response.json()
        
        # Should have 8 tasks from template
        assert "tasks" in project
        assert len(project["tasks"]) == 8
        
        # Verify task names match template
        task_names = [t["name"] for t in project["tasks"]]
        expected_tasks = [
            "Steel Partitions", "Aluminium Joinery", "Doors",
            "Gib & Villa Board Linings", "Plastering", "Concealed Grid",
            "2-Way Grid & Tiles", "Feature Linings"
        ]
        for expected in expected_tasks:
            assert expected in task_names
    
    def test_get_projects_list(self, api_client, base_url):
        """Get all projects"""
        response = api_client.get(f"{base_url}/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTasks:
    """Task CRUD and hour logging tests"""
    
    def test_create_task_and_log_hours(self, api_client, base_url):
        """Create project, add task, log hours, verify staff calculator"""
        # Create project first
        project_payload = {
            "name": "TEST_Task_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project = project_response.json()
        project_id = project["id"]
        
        # Create task
        task_payload = {
            "name": "TEST_Steel_Partitions",
            "duration_days": 5,
            "quoted_hours": 180,
            "order": 0,
            "dependencies": [],
            "assigned_to": []
        }
        task_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task_payload)
        assert task_response.status_code == 200
        task = task_response.json()
        task_id = task["id"]
        
        # Verify task was created with correct data
        assert task["name"] == task_payload["name"]
        assert task["quoted_hours"] == task_payload["quoted_hours"]
        assert task["duration_days"] == task_payload["duration_days"]
        assert task["required_staff"] > 0  # Staff calculator should work
        
        # Log hours
        log_payload = {
            "team_member_name": "Test User",
            "hours": 8.5,
            "date": "2026-05-01",
            "notes": "Test work"
        }
        log_response = api_client.post(f"{base_url}/api/tasks/{task_id}/log-hours", json=log_payload)
        assert log_response.status_code == 200
        
        # GET task to verify logged hours
        task_get_response = api_client.get(f"{base_url}/api/tasks/{task_id}")
        assert task_get_response.status_code == 200
        updated_task = task_get_response.json()
        assert updated_task["logged_hours"] == 8.5
        assert updated_task["progress_indicator"] == "green"  # Under time
        
        # GET hour logs
        hours_response = api_client.get(f"{base_url}/api/tasks/{task_id}/hours")
        assert hours_response.status_code == 200
        hours = hours_response.json()
        assert len(hours) == 1
        assert hours[0]["hours"] == 8.5
    
    def test_update_task(self, api_client, base_url):
        """Update task quoted hours and verify recalculation"""
        # Create project and task
        project_payload = {
            "name": "TEST_Update_Task_Project",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        task_payload = {
            "name": "TEST_Task_To_Update",
            "duration_days": 5,
            "quoted_hours": 100,
            "order": 0
        }
        task_response = api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task_payload)
        task_id = task_response.json()["id"]
        
        # Update task
        update_payload = {
            "quoted_hours": 200,
            "duration_days": 10
        }
        update_response = api_client.put(f"{base_url}/api/tasks/{task_id}", json=update_payload)
        assert update_response.status_code == 200
        updated_task = update_response.json()
        assert updated_task["quoted_hours"] == 200
        assert updated_task["duration_days"] == 10


class TestTeam:
    """Team member CRUD tests"""
    
    def test_create_team_member(self, api_client, base_url):
        """Create team member and verify persistence"""
        import time
        unique_name = f"TEST_John_Doe_{int(time.time())}"
        create_payload = {
            "name": unique_name,
            "role": "Site Manager"
        }
        create_response = api_client.post(f"{base_url}/api/team", json=create_payload)
        assert create_response.status_code == 200
        
        created_member = create_response.json()
        assert created_member["name"] == create_payload["name"]
        assert created_member["role"] == create_payload["role"]
        member_id = created_member["id"]
        
        # GET team list to verify
        get_response = api_client.get(f"{base_url}/api/team")
        assert get_response.status_code == 200
        team = get_response.json()
        assert any(m["id"] == member_id for m in team)
    
    def test_create_duplicate_team_member(self, api_client, base_url):
        """Creating duplicate team member should fail"""
        import time
        unique_name = f"TEST_Duplicate_User_{int(time.time())}"
        create_payload = {
            "name": unique_name,
            "role": "Worker"
        }
        # First creation should succeed
        first_response = api_client.post(f"{base_url}/api/team", json=create_payload)
        assert first_response.status_code == 200
        
        # Second creation should fail
        second_response = api_client.post(f"{base_url}/api/team", json=create_payload)
        assert second_response.status_code == 400


class TestSaveAsTemplate:
    """Save project as template"""
    
    def test_save_project_as_template(self, api_client, base_url):
        """Create project with tasks and save as template"""
        # Create project
        project_payload = {
            "name": "TEST_Custom_Fitout",
            "start_date": "2026-05-01",
            "saturday_enabled": False,
            "location_region": "AUK",
            "created_by": "Test User"
        }
        project_response = api_client.post(f"{base_url}/api/projects", json=project_payload)
        project_id = project_response.json()["id"]
        
        # Add tasks
        task1_payload = {
            "name": "Custom Task 1",
            "duration_days": 3,
            "quoted_hours": 50,
            "order": 0
        }
        api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task1_payload)
        
        task2_payload = {
            "name": "Custom Task 2",
            "duration_days": 5,
            "quoted_hours": 80,
            "order": 1
        }
        api_client.post(f"{base_url}/api/projects/{project_id}/tasks", json=task2_payload)
        
        # Save as template
        template_payload = {
            "name": "TEST_My_Custom_Template",
            "description": "Custom template from test",
            "project_id": project_id
        }
        template_response = api_client.post(f"{base_url}/api/templates/save-from-project", json=template_payload)
        assert template_response.status_code == 200
        
        template = template_response.json()
        assert template["name"] == template_payload["name"]
        assert template["is_default"] is False
        assert len(template["tasks"]) == 2
        
        # Verify template appears in templates list
        templates_response = api_client.get(f"{base_url}/api/templates")
        templates = templates_response.json()
        assert any(t["id"] == template["id"] for t in templates)
