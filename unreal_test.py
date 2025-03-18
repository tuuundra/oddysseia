import unreal
import math
import random

def add_fragment_components():
    """
    Adds StaticMeshComponents for geometry collection fragments (indices 121 to 387)
    to a Blueprint, positioning them in a boulder formation.
    """
    # Define the Blueprint path
    bp_path = "/Game/BlankDefault/BP_ExplodedGeometry"
    bp = unreal.EditorAssetLibrary.load_asset(bp_path)
    if not bp:
        unreal.log_error(f"Failed to load Blueprint at {bp_path}")
        return

    # Debug: Inspect the generated_class and Blueprint details
    generated_class = bp.generated_class
    unreal.log(f"Generated class type: {type(generated_class)}, Value: {generated_class}")
    unreal.log(f"Blueprint name: {bp.get_name()}, Full path: {bp.get_path_name()}")

    # Get the editor subsystem to access the world
    editor_subsystem = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    world = editor_subsystem.get_editor_world()
    if not world:
        unreal.log_error("Failed to get editor world")
        return

    # Get the generated class from the Blueprint with fallback
    bp_generated_class = bp.generated_class
    if not bp_generated_class or not isinstance(bp_generated_class, unreal.BlueprintGeneratedClass):
        unreal.log_warning("Invalid or unsupported generated class from bp.generated_class. Attempting to load class...")
        class_path = f"{bp_path}.{bp.get_name()}_C"
        bp_generated_class = unreal.load_class(None, class_path)
        if not bp_generated_class or not isinstance(bp_generated_class, unreal.BlueprintGeneratedClass):
            unreal.log_error(f"Failed to load valid generated class from {class_path}. Ensure Blueprint is compiled and valid.")
            return

    # Spawn a temporary instance of the Blueprint in the level
    actor_location = unreal.Vector(0, 0, 0)  # Temporary location
    bp_instance = unreal.EditorLevelLibrary.spawn_actor_from_class(bp_generated_class, actor_location)
    if not bp_instance:
        unreal.log_error("Failed to spawn Blueprint instance")
        return

    # Get the root component (existing GeometryCollectionComponent)
    root_component = bp_instance.get_component_by_class(unreal.SceneComponent)
    if not root_component:
        unreal.log_warning("No root SceneComponent found; using GeometryCollectionComponent as root")
        root_component = bp_instance.get_component_by_class(unreal.GeometryCollectionComponent)
    unreal.log(f"Using root component: {root_component.get_name()}")

    # Setup for fragment positioning
    start_index = 121
    end_index = 387
    total_fragments = end_index - start_index + 1
    unreal.log(f"Processing {total_fragments} fragments from index {start_index} to {end_index}")
    
    # Boulder formation parameters
    center = unreal.Vector(0, 0, 0)  # Center of boulder
    base_radius = 100.0  # Base radius in Unreal units
    scale = 0.25  # Scale factor for meshes
    gap_size = 0.5  # Small gap between fragments
    
    # Function to generate a 3D position on the surface of a boulder
    def get_boulder_point(theta, phi, radius, index):
        # Convert spherical coordinates to cartesian
        x = center.x + radius * math.sin(phi) * math.cos(theta)
        y = center.y + radius * math.sin(phi) * math.sin(theta)
        z = center.z + radius * math.cos(phi)
        
        # Apply a slight distortion to make the shape more rock-like
        noise = (math.sin(theta * 5 + phi * 3) * 5.0 + 
                math.cos(theta * 7 - phi * 2) * 3.0 + 
                (5.0 if index % 3 == 0 else 0))  # Occasional bumps
        
        return unreal.Vector(
            x + noise, 
            y + noise * 0.8, 
            z + noise
        )
    
    # Counter for successfully added components
    components_added = 0
    
    # Get the factory for creating components
    component_factory = unreal.EditorComponentFactory() if hasattr(unreal, 'EditorComponentFactory') else None
    factory_available = component_factory is not None
    
    # Get the Blueprint editor subsystem if available (for newer UE versions)
    blueprint_editor = unreal.get_editor_subsystem(unreal.BlueprintEditorSubsystem) if hasattr(unreal, 'BlueprintEditorSubsystem') else None
    
    # Use the factory approach or direct blueprint modification based on availability
    if factory_available:
        unreal.log("Using EditorComponentFactory for component creation")
    elif blueprint_editor:
        unreal.log("Using BlueprintEditorSubsystem for component creation")
    else:
        unreal.log_warning("Neither EditorComponentFactory nor BlueprintEditorSubsystem available. Attempting direct component creation.")
    
    # Add all static mesh components
    for i in range(start_index, end_index + 1):
        mesh_name = f"NewGeometryCollection_SM_{i}_"
        mesh_path = f"/Game/BlankDefault/{mesh_name}"
        
        # Verify mesh asset exists
        mesh_asset = unreal.EditorAssetLibrary.load_asset(mesh_path)
        if not mesh_asset or not isinstance(mesh_asset, unreal.StaticMesh):
            unreal.log_warning(f"Static mesh not found at {mesh_path}. Skipping fragment {i}.")
            continue
        
        # Generate position for this fragment using fibonacci sphere distribution
        index = i - start_index
        golden_ratio = (1 + math.sqrt(5)) / 2
        theta = 2 * math.pi * index / golden_ratio
        phi = math.acos(1 - 2 * (index + 0.5) / total_fragments)
        
        # Adjust radius slightly to create a more non-uniform boulder shape
        normalized_index = index / total_fragments
        radius = base_radius
        if normalized_index < 0.3:
            # Bottom pieces slightly compressed
            radius *= 0.9
        elif normalized_index > 0.7:
            # Top pieces slightly extended
            radius *= 1.1
            
        # Get position and rotation for this fragment
        position = get_boulder_point(theta, phi, radius, index)
        
        # Add small random gap between fragments
        gap_offset = unreal.Vector(
            (random.random() - 0.5) * gap_size,
            (random.random() - 0.5) * gap_size,
            (random.random() - 0.5) * gap_size
        )
        position += gap_offset
        
        # Calculate rotation to align with normal vector from center to position
        normal = position - center
        normal.normalize()
        # Convert normal to rotation (simplified - adequate for visualization)
        rotation = normal.rotation()
        # Add slight random rotation for variety
        rotation.roll += (random.random() - 0.5) * 10.0
        rotation.pitch += (random.random() - 0.5) * 10.0
        rotation.yaw += (random.random() - 0.5) * 10.0
        
        # Create component name
        component_name = f"FragmentMesh_{i}"
        
        try:
            # Create and setup the static mesh component
            static_mesh_component = None
            
            # Different methods to create component based on available APIs
            if factory_available:
                # Use factory to create component (UE4 approach)
                static_mesh_component = component_factory.create_component(
                    bp_instance,
                    unreal.StaticMeshComponent.static_class(),
                    unreal.Name(component_name)
                )
            elif blueprint_editor:
                # Use blueprint editor subsystem (UE5 approach)
                component_data = unreal.ComponentCreationParams(
                    component_class=unreal.StaticMeshComponent.static_class(),
                    name=unreal.Name(component_name),
                    parent=root_component
                )
                static_mesh_component = blueprint_editor.add_component_to_blueprint(
                    bp,
                    component_data
                )
            else:
                # Direct approach (may not work in all UE versions)
                static_mesh_component = unreal.StaticMeshComponent(
                    bp_instance, 
                    unreal.Name(component_name)
                )
                bp_instance.add_instance_component(static_mesh_component)
                static_mesh_component.register_component()
            
            if static_mesh_component:
                # Configure the component
                static_mesh_component.set_static_mesh(mesh_asset)
                static_mesh_component.set_relative_location(position)
                static_mesh_component.set_relative_rotation(rotation)
                static_mesh_component.set_relative_scale3d(unreal.Vector(scale, scale, scale))
                
                # Enable collision and physics (similar to UE5 fracture setup)
                static_mesh_component.set_collision_profile_name("PhysicsActor")
                static_mesh_component.set_generate_overlap_events(True)
                static_mesh_component.set_simulation_generates_hit_events(True)
                
                # Set material properties
                for j in range(static_mesh_component.get_num_materials()):
                    # Try to create and set a dynamic material instance
                    try:
                        material_slot_name = unreal.Name(f"Material_{j}")
                        material = unreal.MaterialInstanceDynamic.create(
                            static_mesh_component,
                            None,  # Parent material will be the one on the mesh
                            material_slot_name
                        )
                        static_mesh_component.set_material(j, material)
                        
                        # Set material properties - rock-like appearance
                        material.set_vector_parameter_value(
                            "BaseColor", 
                            unreal.LinearColor(0.38, 0.38, 0.38, 1.0)  # Gray rock color
                        )
                        material.set_scalar_parameter_value("Roughness", 0.8)
                        material.set_scalar_parameter_value("Metallic", 0.2)
                    except Exception as mat_error:
                        unreal.log_warning(f"Could not set material for component {component_name}: {mat_error}")
                
                # Increment success counter
                components_added += 1
                if components_added % 10 == 0:
                    unreal.log(f"Added {components_added} components so far...")
                
            else:
                unreal.log_error(f"Failed to create StaticMeshComponent for {mesh_name}")
                
        except Exception as e:
            unreal.log_error(f"Error creating component for {mesh_name}: {str(e)}")
    
    # Save the Blueprint with all the added components
    try:
        unreal.log(f"Attempting to save Blueprint with {components_added} added components...")
        
        # Different save methods based on available APIs
        if blueprint_editor:
            blueprint_editor.compile_blueprint(bp)
            saved = unreal.EditorAssetLibrary.save_asset(bp_path)
        else:
            # Legacy approach
            saved = unreal.EditorAssetLibrary.save_asset(bp_path)
        
        if saved:
            unreal.log(f"Successfully saved Blueprint with {components_added} components.")
        else:
            unreal.log_error("Failed to save Blueprint.")
    except Exception as save_error:
        unreal.log_error(f"Error saving Blueprint: {str(save_error)}")
    
    # Clean up temporary actor
    try:
        editor_actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
        if editor_actor_subsystem:
            editor_actor_subsystem.destroy_actor(bp_instance)
        else:
            unreal.log_warning("Failed to get EditorActorSubsystem; falling back to deprecated destroy_actor")
            unreal.EditorLevelLibrary.destroy_actor(bp_instance)
    except Exception as cleanup_error:
        unreal.log_error(f"Error during cleanup: {str(cleanup_error)}")
    
    # Final status message
    if components_added > 0:
        unreal.log(f"Successfully added {components_added} StaticMeshComponents to the Blueprint.")
        unreal.log(f"The Blueprint '{bp_path}' has been updated with a boulder formation of rock fragments.")
        unreal.log("You can now use this Blueprint in your level to display the assembled rock.")
    else:
        unreal.log_error("No components were added to the Blueprint. Check the logs for errors.")

# Execute the script
if __name__ == "__main__":
    add_fragment_components()