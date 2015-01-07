'use strict';

/*
Copyright 2015 Ralph Thomas

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// iOS control center example.
function makeControlCenter(parentElement) {
    // Use an iPhone 5 resolution, since the control center asset is really tall.
    var parentWidth = 320;
    var parentHeight = 568;

    var controlCenterHeight = 428;

    var context = new MotionContext();
    var solver = context.solver();

    var backdrop = new Box(parentElement.querySelector('.backdrop'));
    var controlCenter = new Box(parentElement.querySelector('.control-center'));

    // The sensor is the DOM object that takes the touch events.
    var controlSensor = new Box(parentElement.querySelector('.control-sensor'));

    context.addBox(backdrop);
    context.addBox(controlCenter);
    context.addBox(controlSensor);

    backdrop.x = 0;
    backdrop.y = 0;
    backdrop.right = parentWidth;
    backdrop.bottom = parentHeight;

    controlCenter.x = 0;
    controlCenter.right = parentWidth;
    controlCenter.y = new c.Variable({name: 'control-center-y'});
    controlCenter.bottom = new c.Variable({name: 'control-center-bottom'});

    controlSensor.x = 0;
    controlSensor.right = parentWidth;
    controlSensor.y = new c.Variable({name: 'control-sensor-y'});
    controlSensor.bottom = new c.Variable({name: 'control-sensor-bottom'});
    
    // Make the control center the right height; make it a bit taller actually so when it's
    // exposed by overdragging we don't show the desktop underneath.
    solver.add(eq(controlCenter.bottom, c.plus(controlCenter.y, parentHeight + 100), medium));
    // Move the control center to be offscreen to start with.
    solver.add(eq(controlCenter.y, parentHeight, weak));

    // Introduce a variable to make the motion constraints easier to specify.
    var offset = new c.Variable({name: 'control-center-offset'});
    solver.add(eq(controlCenter.y, c.plus(parentHeight, offset), medium));

    // Add some constraints on the control center. It's basically a vertical pager with two elements
    // (one visible and one invisible), so we can model it using the modulo operator.
    context.addMotionConstraint(new MotionConstraint(offset, mc.adjacentModulo, controlCenterHeight,
        { overdragCoefficient: 0, captive: true }));
    context.addMotionConstraint(new MotionConstraint(offset, '<=', 0));
    context.addMotionConstraint(new MotionConstraint(offset, '>=', -controlCenterHeight));

    // Add some constraints to position the object that takes the drag events.
    //  controlSensor.y = controlCenter.y - 100 // expose some sensor when the control center is hidden.
    solver.add(eq(controlSensor.y, c.plus(controlCenter.y, -100), medium));
    solver.add(eq(controlSensor.bottom, c.plus(controlSensor.y, parentHeight), medium));

    // Add a manipulator to the control center's y.
    context.addManipulator(new Manipulator(controlCenter.y, solver, context.update.bind(context), controlSensor.element(), 'y'));


    // Now do the pulldown menu from the top. This one uses gravity and is interesting because
    // the constraint's physics model changes depending on the direction of the gesture.
    var menu = new Box(parentElement.querySelector('.menu'));

    // The menu sensor takes touch events for the menu, we leave some of it peeking out when the
    // menu is hidden to get those edge events. Because this example is nested in a page we make
    // the sensor area huge.
    var menuSensor = new Box(parentElement.querySelector('.menu-sensor'));

    context.addBox(menu);
    context.addBox(menuSensor);

    menu.x = 0;
    menu.right = parentWidth;
    menu.y = new c.Variable({name: 'menu-y'});
    menu.bottom = new c.Variable({name: 'menu-bottom'});

    menuSensor.x = 0;
    menuSensor.right = parentWidth;
    menuSensor.y = new c.Variable({name: 'menu-y'});
    menuSensor.bottom = new c.Variable({name: 'menu-bottom'});

    // Make the menu the right height (menu.bottom = menu.y + parentHeight)
    solver.add(eq(menu.bottom, c.plus(menu.y, parentHeight), medium));
    // Hide the menu off the top of the screen.
    solver.add(eq(menu.bottom, 0, weak));

    // Don't let the menu go past the bottom or top, hard constraint.
    solver.add(leq(menu.y, 0, required));
    solver.add(geq(menu.bottom, 0, required));


    // The menu can either go to the bottom, or to the top. It can't be in between. We could use
    // modulo for this, but we want to use a different physics simulation depending on which direction
    // we're going in, so instead we'll write a custom motion constraint that is enforced depending on
    // the drag direction and has a different physics method.
    //
    // This is a bit clumsy, it'd be nice to either make this more natural or come up with a better
    // concept for how to switch physics models based on different predicates...
    function directionalOp(a, b, naturalEnd, gestureStart) {
        // Make a physics model that rebounds.
        function reboundingModel() {
            var model = new GravityWithBounce(8000, 0.3);
            model.snap = function(end) { this.set(end, 0); }
            model.setEnd = function(end, v) { this.set(this.x(), v); }
            return model;
        }
        function accelerateAwayModel() {
            var model = new Gravity(-8000, parentHeight);
            model.snap = function(end) { this.set(end, 0); }
            model.setEnd = function(end, v) { this.set(this.x(), v); }
            return model;
        }
        if (a <= 0) return 0;
        if (a >= parentHeight) return 0;
    
        if (gestureStart === undefined) return parentHeight - a;

        var direction = a - gestureStart;

        var target = 0;
        if (direction > 0) {
            target = parentHeight;
            this.physicsModel = reboundingModel;
        } else {
            this.physicsModel = accelerateAwayModel;
        }

        return target - a;
    }
    context.addMotionConstraint(new MotionConstraint(menu.bottom, directionalOp, 0,
        { captive: true, overdragCoefficient: 0 }));

    // Position the sensor.
    solver.add(eq(menuSensor.y, menu.y, medium));
    solver.add(eq(menuSensor.bottom, c.plus(menu.bottom, 100), medium));

    // Create a manipulator. We override the motion type to use gravity.
    context.addManipulator(new Manipulator(menu.y, solver, context.update.bind(context), menuSensor.element(), 'y'));
}

makeControlCenter(document.getElementById('ios-example'));
